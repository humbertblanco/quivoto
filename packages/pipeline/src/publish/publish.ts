import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import {
  candidacies, candidatures, councilTerms, councillorMandates, electionResults, municipalities,
  municipalityMetrics, people, type Db,
} from "@quivoto/db";
import { loadRadiografia, renderRadiografia } from "./radiografia";
import { carregaMedianes } from "./medianes";
import { escriuCerca, escriuCercaElectes } from "./cerca";
import { carregaSeriesGrup } from "./series-grup";
import { loadEls947, renderEls947 } from "./els947";
import { INDEXABLE, SITE } from "./config";
import { loadComarques, renderComarca } from "./comarques";
import { renderComarquesIndex, type ComarcaFila } from "./comarques-index";
import { loadAmb, renderAmb } from "./amb";
import { loadTrajectoriaElectes, renderTrajectoriaElectes } from "./trajectoria-electes";
import { loadComparador, renderComparador } from "./comparador";
import { renderDadesIndex, writeDownloads } from "./dades";
import { clau, loadCandidatures, renderCandidatura } from "./candidatura";
import { loadPartits, renderPartit } from "./partit";
import { renderPartitsIndex } from "./partits-index";
import { fixaXifresPeu, XIFRES_PEU } from "./peu";
import { KIND as KIND_TRAJECTORIA, type FitxaTrajectoria } from "../jobs/j21-trajectoria-electes";
import { ELECCIO as ELECCIO_CAPS, KIND as KIND_CAPS, type FitxaCapsDeLlista } from "../jobs/j27-caps-de-llista";
import { writeOgImages } from "./og";
import type { PuntMapa } from "./mapa";
import { carregaPreguntes, renderIndexPreguntes, renderPreguntes } from "./preguntes";
import { renderProva } from "./prova";
import { verifica } from "./verificacio";
import { renderPortada } from "./portada";
import { renderMapaCatalunya } from "./mapa-catalunya";
import { loadVotsPartit } from "./vots-partit";
import { loadPortadaMostra } from "./portada-mostra";
import { encaixa, type Grup } from "./posicions";
import {
  adrecesRegidors, quiEsDeWikidata, renderRegidor, trajectoriaDePersona, type ContextRegidor, type Regidor,
} from "./regidor";
import { sameForce } from "@quivoto/shared-schemas/brands";
import { normalize, normalizePersonName, slugify } from "../lib/text";
import { withRun } from "../lib/run";

/**
 * Genera les radiografies com a fitxers estàtics. Van a `web/public/proves/`
 * i amb `noindex`: són esborranys per mirar-los i ensenyar-los, no la portada
 * pública de quivoto, que continua sent la pàgina de properament.
 */

const OUT_DIR = new URL("../../../../web/public/observatori/m/", import.meta.url).pathname;

/** Municipis del primer lot, si no se'n demana cap en concret. */
const DEFAULT_SLUGS = ["esplugues-de-llobregat", "sabadell", "girona", "reus", "barcelona", "rubi"];

/**
 * Els municipis que tenen fitxa **a disc**, no els que s'acaben de generar.
 *
 * Les pàgines globals —la portada, el sitemap, els 947 i la pàgina de dades—
 * parlen de tot l'Observatori, i publicar-ne sis en fa sis d'aquelles quatre.
 * Va passar: la portada deia «Els 6 municipis», `dades/` deia «6 municipis · 0
 * camps», el sitemap tenia 54 adreces i `els947.html` només enllaçava sis
 * fitxes, mentre a `m/` n'hi havia 947 i el CSV en portava 947 amb 53 columnes.
 * I era pitjor que un error visible, perquè les pàgines existien i feien bona
 * cara.
 *
 * Mirar el directori, i no la llista del que s'acaba d'escriure, fa que
 * `publica girona` deixi la resta del web dient la veritat.
 */
async function fitxesADisc(dir: string): Promise<Set<string>> {
  const slugs = new Set<string>();
  let entrades: string[];
  try {
    entrades = await readdir(dir);
  } catch {
    return slugs;
  }
  for (const entrada of entrades) {
    if (entrada.startsWith(".")) continue;
    try {
      if ((await stat(`${dir}${entrada}/index.html`)).isFile()) slugs.add(entrada);
    } catch {
      // Sense fitxa no compta: un directori a mitges no és un municipi publicat.
    }
  }
  return slugs;
}

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

    // Els 947 punts del mapa es llegeixen un sol cop: fer-ho dins de cada fitxa
    // voldria dir 947 consultes de 947 files.
    const mapa: PuntMapa[] = (
      await db
        .select({
          slug: municipalities.slug, nom: municipalities.name,
          lat: municipalities.lat, lon: municipalities.lon, pes: municipalities.population,
        })
        .from(municipalities)
    )
      .filter((m) => m.lat !== null && m.lon !== null)
      .map((m) => ({ slug: m.slug, nom: m.nom, lat: Number(m.lat), lon: Number(m.lon), pes: m.pes ?? 0 }));
    const done: string[] = [];

    // Els conjunts d'afirmacions es carreguen abans de les fitxes perquè cada
    // fitxa hi pugui enllaçar: és el pas de «mira les dades» a «jutja-ho tu».
    const conjunts = carregaPreguntes();
    const preguntesPerSlug = new Map(
      conjunts.map((c) => [c.slug, { jugable: verifica(c).jugable, quantes: c.afirmacions.length }]),
    );
    /**
     * L'índex dels 947 i el mapa es generen **abans** de les fitxes.
     *
     * PGlite es queda sense memòria després d'una sessió llarga, i amb 947
     * radiografies, 4.807 fitxes de regidor i 2.626 candidatures pel mig, la
     * consulta que els alimentava petava just al final: el mapa no s'arribava a
     * generar mai i no ho notava ningú perquè l'error surt després d'haver
     * escrit tota la resta. Fent-ho primer, la consulta es fa amb el motor
     * acabat d'obrir.
     */
    const carregats = await loadEls947(db);
    /**
     * Les medianes del grup, calculades un sol cop per a les 947 fitxes.
     *
     * Van aquí i no dins de `loadRadiografia` perquè per saber la mediana d'un
     * municipi cal llegir-los tots: fer-ho fitxa per fitxa serien 947 lectures
     * de la taula sencera i la publicació no s'acabaria mai.
     */
    const medianes = await carregaMedianes(db);
    /**
     * I les sèries del grup, pel mateix motiu: la banda que va darrere del
     * deute de cada fitxa és la meitat central dels municipis de la seva mida
     * any per any, i per saber-la cal haver llegit els 947.
     */
    const seriesGrup = await carregaSeriesGrup(db);
    await mkdir(`${OUT_DIR}../mapa`, { recursive: true });
    await writeFile(`${OUT_DIR}../mapa/index.html`, renderMapaCatalunya(carregats, generatedAt, await loadVotsPartit(db)), "utf8");
    run.say(`mapa de Catalunya amb ${carregats.length} municipis`);
    // L'índex del cercador, al costat del mapa i pel mateix motiu: es fa amb
    // la consulta dels 947 acabada de llegir i no la torna a demanar.
    const quants = await escriuCerca(carregats, `${OUT_DIR}../cerca.json`);
    run.say(`índex de cerca amb ${quants} municipis`);
    /*
     * El segon índex: qui seu als plens i amb quina llista s'hi va presentar.
     *
     * Va a part i no dins del primer perquè no el necessita tothom: qui obre la
     * casella per anar al seu poble ja té resposta amb els 947 i l'alcaldia, i
     * els 4.807 regidors i les 2.626 candidatures són el doble de pes per a una
     * pregunta que es fa molta menys gent. El navegador se'l baixa en segon pla
     * quan el primer ja ha arribat.
     */
    const electes = await escriuCercaElectes(db, carregats, `${OUT_DIR}../cerca-electes.json`);
    run.say(`índex d'electes amb ${electes.regidors} regidors i ${electes.candidatures} candidatures`);

    // El peu de cada pàgina ensenya el que s'ha comptat en aquesta publicació i
    // no una xifra escrita a mà que envelleix sola. Va aquí perquè la primera
    // pàgina que s'escriu ja el porti bo.
    fixaXifresPeu({
      municipis: carregats.length,
      electes: electes.regidors,
      candidatures: electes.candidatures,
      fitxersDades: XIFRES_PEU.fitxersDades,
    });

    /*
     * Les fitxes de trajectòria, totes de cop i abans del bucle: són 947 files
     * petites i fer-ne una consulta per municipi serien 947 anades a la base per
     * una dada que hi cap sencera a la memòria.
     *
     * D'aquí en surt el bloc «Més enllà de l'ajuntament» de la fitxa de persona,
     * que és el que tanca el cercle amb /observatori/trajectoria/: aquella
     * pàgina porta el nom cap aquí, i aquesta hi torna.
     */
    const trajectoriaPerMunicipi = new Map<number, FitxaTrajectoria>(
      (
        await db
          .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
          .from(municipalityMetrics)
          .where(eq(municipalityMetrics.kind, KIND_TRAJECTORIA))
      ).map((f) => [f.municipalityId, f.data as FitxaTrajectoria]),
    );

    /*
     * I les de J27, pel mateix motiu: qui era cada cap de llista del 2023
     * segons Wikidata. Va a la pàgina de la persona només quan J21 no en sap
     * res, que és el cas de tothom que no és alcalde.
     */
    const capsPerMunicipi = new Map<number, FitxaCapsDeLlista>(
      (
        await db
          .select({ municipalityId: municipalityMetrics.municipalityId, data: municipalityMetrics.data })
          .from(municipalityMetrics)
          .where(eq(municipalityMetrics.kind, KIND_CAPS))
      ).map((f) => [f.municipalityId, f.data as FitxaCapsDeLlista]),
    );
    /*
     * Les candidatures proclamades del 2023, que cap pàgina no llegia: és el
     * que permet dir de cada persona del ple amb quin número hi anava i, de
     * qui encapçalava una llista, què va treure aquella llista.
     */
    const candidatures2023 = await carregaCandidatures2023(db);
    /*
     * I el pas de cadascú pels plens i per les llistes de totes les municipals
     * ingerides: és el que permet dir «tercer mandat seguit» quan hi ha més
     * d'una municipal al registre, i callar quan només n'hi ha una.
     */
    const historialMandats = await carregaHistorialMandats(db);
    run.say(`candidatures del 2023 de ${candidatures2023.size} municipis · fitxes de caps de llista de ${capsPerMunicipi.size}`);

    let regidorsEscrits = 0;
    for (const slug of wanted) {
      const data = await loadRadiografia(db, slug, generatedAt);
      if (!data) {
        await run.issue({ kind: "unknown_slug", severity: "mitjana", entity: slug });
        continue;
      }
      const html = renderRadiografia(
        data,
        mapa,
        preguntesPerSlug,
        medianes.get(data.municipality.id),
        seriesGrup.get(data.municipality.id),
      );
      await mkdir(`${OUT_DIR}${slug}`, { recursive: true });
      await writeFile(`${OUT_DIR}${slug}/index.html`, html, "utf8");
      regidorsEscrits += await escriuRegidors(
        data,
        slug,
        generatedAt,
        trajectoriaPerMunicipi.get(data.municipality.id) ?? null,
        capsPerMunicipi.get(data.municipality.id) ?? null,
        candidatures2023.get(data.municipality.id),
        historialMandats.get(data.municipality.id),
      );
      if (!all) run.say(`${data.municipality.name} → observatori/m/${slug}/ (${Math.round(html.length / 1024)} kB)`);
      done.push(slug);
      run.rowsOut += 1;
    }

    if (all) run.say(`${done.length} radiografies generades`);
    run.say(`${regidorsEscrits} fitxes de regidor`);

    // Tot el que les pàgines globals han de comptar: el que hi ha publicat, no
    // el que s'acaba d'escriure. En ordre de població, com els 947.
    const aDisc = await fitxesADisc(OUT_DIR);
    const publicades = carregats.map((fila) => fila.s).filter((slug) => aDisc.has(slug));
    if (publicades.length !== done.length) {
      run.say(`${done.length} fitxes escrites ara · ${publicades.length} publicades en total`);
    }


    // Una pàgina per candidatura amb representació: és el subjecte que la
    // brúixola compararà, i qui busca un partit al seu poble hi arriba directe.
    const totes = await loadCandidatures(db);
    for (const candidatura of totes) {
      const dir = `${OUT_DIR}${candidatura.municipality.slug}/${candidatura.slug}`;
      await mkdir(dir, { recursive: true });
      await writeFile(`${dir}/index.html`, renderCandidatura(candidatura, generatedAt), "utf8");
    }
    run.say(`${totes.length} pàgines de candidatura`);

    /*
     * Una pàgina per marca política, que és el subjecte del qual parlen tots els
     * titulars —«ERC perd pobles», «el PSC recupera el territori»— i que fins ara
     * no es podia comprovar enlloc del web, tot i que la dada hi era sencera.
     *
     * La germana petita ja existia: la pàgina de candidatura és aquesta mateixa
     * marca en UN municipi, i n'hi ha 2.626. El que faltava era el nivell de
     * sobre, i és el que fa que buscar «esquerra» al cercador porti a algun lloc.
     */
    const partits = await loadPartits(db);
    for (const partit of partits) {
      const dir = `${OUT_DIR}../partit/${partit.id}`;
      await mkdir(dir, { recursive: true });
      await writeFile(`${dir}/index.html`, renderPartit(partit, generatedAt), "utf8");
    }
    /*
     * La portada de les marques. Les 15 pàgines existien i no hi havia índex, de
     * manera que «Partits» al menú hauria estat un 404 i només s'hi arribava pel
     * cercador. És també l'únic lloc del web on es veu com es reparteixen les 947
     * alcaldies: 850 són d'alguna marca i 97 de llistes locals.
     */
    await writeFile(
      `${OUT_DIR}../partit/index.html`,
      // `PartitData` en diu `name` i la portada en diu `nom`: cada mòdul té el
      // seu tipus mínim a posta, per no lligar-los l'un a l'altre.
      renderPartitsIndex(
        partits.map((p) => ({
          id: p.id,
          sigles: p.sigles,
          nom: p.name,
          color: p.color,
          alcaldies: p.alcaldies,
          regidories: p.regidories,
          poblacioGovernada: p.poblacioGovernada,
        })),
        partits[0]?.poblacioCatalunya ?? 0,
        generatedAt,
      ),
      "utf8",
    );
    run.say(`${partits.length} pàgines de partit i la seva portada`);

    // Pàgines de comarca: «qui mana a la meva comarca» no ho respon ningú.
    const comarques = await loadComarques(db);
    // Les files de l'índex es recullen al mateix bucle perquè el slug de cada
    // fila sigui el del directori que s'acaba d'escriure, i no un de calculat
    // dues vegades que un dia podria divergir.
    const filesComarques: ComarcaFila[] = [];
    for (const comarca of comarques) {
      const slug = slugify((comarca as { name?: string; nom?: string }).name ?? (comarca as { nom?: string }).nom ?? "");
      if (!slug) continue;
      await mkdir(`${OUT_DIR}../c/${slug}`, { recursive: true });
      await writeFile(`${OUT_DIR}../c/${slug}/index.html`, renderComarca(comarca, generatedAt), "utf8");
      filesComarques.push({
        slug,
        name: comarca.name,
        municipis: comarca.municipis.length,
        habitants: comarca.habitants,
        forces: comarca.forces,
        pacte: comarca.pacte,
        canvisAlcaldia: comarca.canvisAlcaldia,
      });
    }
    run.say(`${comarques.length} pàgines de comarca`);

    // L'AMB és un ens propi i no una comarca: agrupa municipis de cinc comarques
    // diferents i decideix el transport, l'aigua i els residus de tots. Es
    // reaprofiten les comarques ja carregades en comptes de tornar a lligar
    // alcaldies i marques per a trenta-sis municipis.
    const amb = await loadAmb(db, comarques);
    if (amb) {
      await mkdir(`${OUT_DIR}../amb`, { recursive: true });
      await writeFile(`${OUT_DIR}../amb/index.html`, renderAmb(amb, generatedAt), "utf8");
      run.say(`pàgina de l'AMB amb ${amb.municipis.length} municipis`);
    } else {
      // Sense J17 no hi ha composició, i una llista inventada seria pitjor que cap.
      run.say("sense pàgina de l'AMB: cap municipi marcat com a metropolità (falta J17)");
    }

    /*
     * L'índex de les comarques. Les 43 pàgines existien i no hi havia índex, de
     * manera que el peu i la portada enviaven al Barcelonès com si fos l'única.
     * Va després de l'AMB perquè l'enllaça amb el que en sabem —quants
     * municipis, de quantes comarques— i només si s'ha publicat.
     */
    await writeFile(
      `${OUT_DIR}../c/index.html`,
      renderComarquesIndex(
        filesComarques,
        generatedAt,
        amb ? { municipis: amb.municipis.length, comarques: amb.comarques.length } : null,
      ),
      "utf8",
    );
    run.say(`índex de les ${filesComarques.length} comarques`);

    /*
     * D'on surten els que manen.
     *
     * De 2.917 alcaldes catalans des del 1979, 284 han ocupat després un càrrec
     * per sobre de l'ajuntament: 213 al Parlament, 46 al Congrés, 46 al Senat,
     * 36 al Govern i 29 a una presidència de diputació. No ho tenim de cap font
     * agregada nostra i afecta justament les persones amb més poder.
     *
     * La pàgina posa la cobertura abans que cap altra xifra, i no per prudència
     * decorativa: dels 284 que han fet el salt, el 95,8 % té article a la
     * Viquipèdia; dels 2.633 que no consta que l'hagin fet, el 12,9 %. Sense
     * dir-ho, la pàgina estaria mesurant qui és prou famós per tenir article i
     * no qui ha fet carrera.
     */
    const trajectoria = await loadTrajectoriaElectes(db);
    if (trajectoria) {
      await mkdir(`${OUT_DIR}../trajectoria`, { recursive: true });
      await writeFile(
        `${OUT_DIR}../trajectoria/index.html`,
        renderTrajectoriaElectes(trajectoria, generatedAt),
        "utf8",
      );
      run.say(`pàgina de trajectòria dels electes`);
    }

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
      renderDadesIndex(generatedAt, { municipis: downloads.municipis, camps: downloads.camps }),
      "utf8",
    );
    run.say(`${downloads.files} fitxers de dades (${Math.round(downloads.bytes / 1024)} kB)`);

    // Una imatge social per municipi: amb la mateixa per a tots, res del que es
    // comparteix diu de quin poble parla.
    const og = await writeOgImages(db, `${OUT_DIR}../og`, all ? undefined : done);
    run.say(`${og.images} imatges socials (${Math.round(og.bytes / 1024)} kB)`);

    // Les preguntes de prova: esborrany, amb l'evidència i el veredicte del
    // llindar a la vista. No és el test; és el material perquè qui conegui el
    // poble el pugui jutjar.
    const preguntes = conjunts;
    if (preguntes.length > 0) {
      for (const conjunt of preguntes) {
        await mkdir(`${OUT_DIR}../preguntes/${conjunt.slug}`, { recursive: true });
        await writeFile(`${OUT_DIR}../preguntes/${conjunt.slug}/index.html`, renderPreguntes(conjunt, generatedAt), "utf8");
        // La demostració que es pot respondre només es genera si el conjunt
        // s'aguanta en actes del ple. Terrassa en tenia vint-i-cinc afirmacions
        // i cap acta: només premsa i dos enllaços al nostre propi web. Deixar
        // respondre allò seria oferir «què n'ha dit el diari» disfressat de «què
        // ha votat cadascú».
        const estat = verifica(conjunt);
        if (!estat.jugable) {
          run.say(`  ${conjunt.municipi}: sense demostració (${estat.motiu})`);
          continue;
        }
        // Necessita el ple d'avui —quins grups hi ha, quants en són i qui és al
        // govern— per poder deduir de les actes quina posició té cadascun.
        const dades = await loadRadiografia(db, conjunt.slug, generatedAt);
        await mkdir(`${OUT_DIR}../preguntes/${conjunt.slug}/prova`, { recursive: true });
        await writeFile(
          `${OUT_DIR}../preguntes/${conjunt.slug}/prova/index.html`,
          renderProva(
            conjunt,
            dades ? grupsDelPle(dades) : [],
            dades?.mocions?.llista ?? [],
            generatedAt,
          ),
          "utf8",
        );
      }
      await writeFile(`${OUT_DIR}../preguntes/index.html`, renderIndexPreguntes(preguntes, generatedAt), "utf8");
      run.say(`${preguntes.length} conjunts de preguntes de prova`);
    }

    // Sitemap: es genera sempre, però només s'enllaça quan siguin indexables.
    const lastmod = generatedAt;
    const urls = [
      `${SITE}/observatori/`,
      `${SITE}/observatori/els947.html`,
      `${SITE}/observatori/mapa/`,
      `${SITE}/observatori/comparador/`,
      `${SITE}/observatori/partit/`,
      ...partits.map((p) => `${SITE}/observatori/partit/${p.id}/`),
      ...(amb ? [`${SITE}/observatori/amb/`] : []),
      `${SITE}/observatori/c/`,
      ...filesComarques.map((c) => `${SITE}/observatori/c/${c.slug}/`),
      ...publicades.map((slug) => `${SITE}/observatori/m/${slug}/`),
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

    // La portada de l'Observatori: es genera amb la resta perquè els números que
    // hi surten siguin els que s'acaben de publicar, i la mostra (municipis
    // grans, partits, mini-mapa) surt de la mateixa base que les pàgines.
    const mostra = await loadPortadaMostra(db);
    await writeFile(
      `${OUT_DIR}../index.html`,
      renderPortada(
        {
          municipis: publicades.length,
          comarques: comarques.length,
          candidatures: totes.length,
          fitxersDades: downloads.files,
          conjuntsPreguntes: preguntes.length,
          amb: amb?.municipis.length ?? null,
          partits: partits.length,
          trajectoria: trajectoria?.persones.length ?? null,
          exemple: preguntes[0]
            ? { slug: preguntes[0].slug, nom: preguntes[0].municipi }
            : null,
          provaDestacada: preguntes[0]
            ? { slug: preguntes[0].slug, nom: preguntes[0].municipi }
            : null,
        },
        generatedAt,
        mostra,
      ),
      "utf8",
    );
    run.say("portada de l'Observatori");

    // «Els 947»: l'índex de tot Catalunya, amb el que en sabem de cadascun.
    const index947 = await carregats;
    await writeFile(`${OUT_DIR}../els947.html`, renderEls947(index947, generatedAt, aDisc), "utf8");
    run.say(`els947.html amb ${index947.length} municipis`);

    /*
     * Aquí hi havia una segona portada.
     *
     * L'Observatori generava `index.html` dues vegades al mateix camí: una amb
     * `renderPortada()`, que és la bona, i una altra amb HTML escrit a mà just
     * després. Com que la segona s'escrivia l'última, **guanyava sempre**, i
     * durant setmanes la portada que es veia no era la que es mantenia: els
     * enllaços nous —el mapa, les preguntes, l'AMB— s'afegien a `portada.ts` i
     * no sortien enlloc, i ningú no ho notava perquè la pàgina existia i tenia
     * bon aspecte.
     *
     * Una sola font. Si hi falta res, va a `portada.ts`.
     */

    return { generades: done.length, municipis: done };
  });
}

/**
 * El ple d'avui, en la forma que necessita la deducció de posicions.
 *
 * Surt de la fitxa de la seu electrònica de l'ajuntament (J11), que és l'única
 * font que diu **qui és a l'equip de govern**, i sense això no hi ha manera
 * d'orientar el sentit d'una votació. Quan un municipi no la té, la llista surt
 * buida i la demostració es queda comparant només amb el govern.
 *
 * El color el posa la candidatura del 2023 que li correspon; el gris és el que
 * queda quan no s'ha pogut lligar, i és preferible a acolorir malament.
 */
function grupsDelPle(dades: NonNullable<Awaited<ReturnType<typeof loadRadiografia>>>): Grup[] {
  const carrecs = dades.carrecs?.carrecs ?? [];
  if (carrecs.length === 0) return [];

  // Les sigles s'agafen creuant PERSONES, no noms de grup.
  //
  // La seu electrònica escriu «Grup Municipal Republicà» i «Grup Municipal
  // Popular», i les actes escriuen «ERC» i «PP». Comparar els dos noms no lliga
  // mai: cap dels dos conté l'altre i la família de sigles d'«un grup municipal
  // republicà» no és reconeixible. Però les dues fonts contenen les mateixes
  // persones, i el nom d'una persona sí que lliga. Creuant-les, cada grup del
  // ple recupera les sigles de la seva candidatura i les actes hi encaixen.
  //
  // Sense això, un sol nom que no lligava descartava la frase sencera i a
  // Esplugues es perdia el desglossament de tota l'oposició.
  const siglesPerPersona = new Map<string, string>();
  for (const regidor of dades.councillors) {
    if (regidor.sigles !== null) siglesPerPersona.set(normalizePersonName(regidor.name), regidor.sigles);
  }

  const per = new Map<string, { escons: number; govern: number; sigles: Map<string, number> }>();
  for (const c of carrecs) {
    const nom = c.grup ?? "Sense grup";
    const acumulat = per.get(nom) ?? { escons: 0, govern: 0, sigles: new Map<string, number>() };
    acumulat.escons += 1;
    if (c.equipGovern) acumulat.govern += 1;
    const sigles = siglesPerPersona.get(normalizePersonName(c.nom));
    if (sigles !== undefined) acumulat.sigles.set(sigles, (acumulat.sigles.get(sigles) ?? 0) + 1);
    per.set(nom, acumulat);
  }

  return [...per.entries()].map(([nom, { escons, govern, sigles }]) => {
    // Les sigles del grup són les de la majoria dels seus membres: si un ha
    // canviat de grup a mig mandat, no ha d'arrossegar tot el grup.
    const majoritaries = [...sigles.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    return {
      nom,
      sigles: majoritaries && majoritaries[1] > escons / 2 ? majoritaries[0] : null,
      escons,
      // Un grup compta com a govern quan tot el grup hi és. Si només n'hi ha una
      // part —passa amb els no adscrits— votarà partit i no serveix per orientar.
      govern: govern === escons && govern > 0,
      color:
        dades.councillors.find((r) => r.groupName !== null && sameForce(r.groupName, nom))?.color ??
        null,
    };
  });
}


/**
 * Les fitxes de les persones que seuen al ple d'un municipi.
 *
 * El vot que s'hi ensenya és el del **grup**, perquè és l'únic que consta a les
 * actes: es reutilitza `deLActa`, que ja sap lligar el nom que escriu l'acta
 * amb el grup del ple i que, davant del dubte, no lliga res.
 */
async function escriuRegidors(
  dades: NonNullable<Awaited<ReturnType<typeof loadRadiografia>>>,
  slug: string,
  generatedAt: string,
  fitxaTrajectoria: FitxaTrajectoria | null = null,
  fitxaCaps: FitxaCapsDeLlista | null = null,
  llistes2023: readonly Candidatura2023[] | undefined = undefined,
  historial: HistorialMunicipi | undefined = undefined,
): Promise<number> {
  /*
   * Qui seu al ple, i d'on ho sabem.
   *
   * Les fitxes de persona sortien **només** de la seu electrònica, i per això
   * només n'hi havia a 464 dels 947 municipis: 4.807 pàgines de les 9.146
   * regidories que hi ha a Catalunya. A Santa Coloma de Gramenet, amb 124.000
   * habitants, no n'hi havia ni una, perquè l'AOC hi serveix un tauler
   * incrustat en comptes de la llista de càrrecs.
   *
   * Però qui seu a cada ple ho sabem dels 947: ho diu la font electoral, que és
   * d'on surten les regidories de cada candidatura. En sabem menys —ni la
   * fotografia, ni si és a l'equip de govern, ni l'enllaç a la fitxa
   * oficial— i el que en sabem és prou per a una pàgina: qui és, de quina
   * llista va sortir, en quina posició i què ha votat el seu grup.
   *
   * La seu electrònica continua manant quan hi és, perquè en diu més. La font
   * electoral hi entra quan aquella no hi arriba, que és el cas de 483 pobles.
   */
  const deLaSeu = dades.carrecs?.carrecs ?? [];
  const carrecs: typeof deLaSeu =
    deLaSeu.length > 0
      ? deLaSeu
      : dades.councillors.map((c) => ({
          nom: c.name,
          carrec: c.role ?? "Regidoria",
          grup: c.groupName,
          // El que la font electoral no diu, i que no s'inventa: la seu
          // electrònica és qui publica la cara, l'equip de govern i la fitxa.
          equipGovern: false,
          foto: null,
          fotoPetita: null,
          fitxa: null,
        })) as typeof deLaSeu;
  if (carrecs.length === 0) return 0;
  const grups = grupsDelPle(dades);
  const perNom = new Map(dades.councillors.map((c) => [normalizePersonName(c.name), c]));
  const canvis = new Map(
    (dades.councilChanges?.changes ?? []).map((c) => [normalizePersonName(c.person), c]),
  );

  // Els vots de cada grup, una sola vegada per municipi i no un cop per persona.
  //
  // `tot` diu si el grup hi va votar sencer, que és el que permet atribuir el
  // vot a cada persona: si un grup de divuit regidories hi posa divuit vots, no
  // queda ningú a qui atribuir un vot diferent. Quan l'acta no dona la xifra,
  // l'adaptador ja ho llegeix com «tot el grup»; quan en dona menys que
  // regidories, algú no hi era o va votar a part i no es pot dir qui.
  const escons = new Map(grups.map((g) => [g.nom, g.escons]));
  const votsPerGrup = new Map<
    string,
    {
      data: string;
      titol: string;
      sentit: string;
      url: string;
      tot: boolean;
      marge: number | null;
      favor: number;
      contra: number;
    }[]
  >();
  for (const punt of dades.mocions?.llista ?? []) {
    if (punt.vots.length === 0) continue;
    // Com de renyida va ser. Un punt aprovat per tothom no separa ningú i no
    // diu res de qui hi seu; un decidit per un vot ho diu tot. El marge és la
    // diferència entre els dos costats: com més petit, més val la pena
    // ensenyar-lo, i és el criteri d'ordenació en comptes de la data.
    let favor = 0;
    let contra = 0;
    for (const v of punt.vots) {
      if (v.sentit === "favor") favor += v.vots ?? 0;
      if (v.sentit === "contra") contra += v.vots ?? 0;
    }
    const marge = favor + contra === 0 ? null : Math.abs(favor - contra);
    for (const vot of punt.vots) {
      if (vot.sentit !== "favor" && vot.sentit !== "contra" && vot.sentit !== "abstencio") continue;
      const grup = encaixa(vot.grup, grups);
      if (grup === null) continue;
      const total = escons.get(grup.nom) ?? 0;
      const llista = votsPerGrup.get(grup.nom) ?? [];
      llista.push({
        data: punt.data,
        titol: punt.titol,
        sentit: vot.sentit,
        url: punt.url,
        tot: vot.vots === null || (total > 0 && vot.vots === total),
        marge,
        favor,
        contra,
      });
      votsPerGrup.set(grup.nom, llista);
    }
  }
  // Primer les renyides, i entre les igual de renyides, les més recents. Les
  // que no porten recompte van al final: no sabem si van separar ningú.
  for (const llista of votsPerGrup.values()) {
    llista.sort((a, b) => {
      const ma = a.marge ?? Number.MAX_SAFE_INTEGER;
      const mb = b.marge ?? Number.MAX_SAFE_INTEGER;
      return ma !== mb ? ma - mb : b.data.localeCompare(a.data);
    });
  }

  const totalSeats = carrecs.length;
  let escrites = 0;
  const adreces = adrecesRegidors(carrecs);
  for (const carrec of carrecs) {
    const clau = normalizePersonName(carrec.nom);
    const delRegistre = perNom.get(clau) ?? null;
    const canvi = canvis.get(clau) ?? null;
    /*
     * La candidatura amb què es va presentar el 2023. El número de llista
     * surt d'aquí i no del número d'ordre del registre d'electes, que és
     * l'ordre del ple sencer: a Barcelona feia sortir la cap de llista d'ERC
     * com a «número 32 de la llista».
     */
    const candidatura = candidatura2023De(llistes2023, carrec.nom, {
      nom: dades.municipality.mayorName ?? dades.government?.mayorName ?? null,
      sigles: dades.government?.mayorSigles ?? null,
    });
    const regidor: Regidor = {
      nom: carrec.nom,
      carrec: carrec.carrec,
      grup: carrec.grup,
      sigles: delRegistre?.sigles ?? null,
      color: delRegistre?.color ?? null,
      equipGovern: carrec.equipGovern,
      foto: carrec.foto ?? carrec.fotoPetita,
      fitxaOficial: carrec.fitxa,
      posicioLlista: candidatura?.posicio ?? null,
      entradaTardana: canvi?.kind === "substitucio",
      canviDeGrup:
        canvi?.kind === "canvi-de-grup" ? { de: canvi.electedFor, a: canvi.nowWith } : null,
    };
    const dir = `${OUT_DIR}${slug}/regidor/${adreces.get(carrec)!}`;
    await mkdir(dir, { recursive: true });
    await writeFile(
      `${dir}/index.html`,
      renderRegidor(
        regidor,
        {
          municipi: dades.municipality.name,
          slug,
          regidories: totalSeats,
          majoria: Math.floor(totalSeats / 2) + 1,
          votsDelGrup: carrec.grup ? votsPerGrup.get(carrec.grup) ?? [] : [],
          actesLlegides: dades.mocions?.actes.llegides ?? 0,
          assistencia: assistenciaDe(dades, carrec.nom, totalSeats),
          adreca: adreces.get(carrec)!,
          governConegut: carrecs.some((c) => c.equipGovern),
          publicaDeLaPersona: publicaDe(dades, carrec.nom),
          // El que Wikidata sap d'aquesta persona i que el nostre registre no sap
          // de ningú: si ha estat al Parlament, al Congrés o al Govern, i què feia
          // abans de la política. Si el nom lliga amb més d'una persona del ple,
          // no s'hi posa res, que és la regla de sempre.
          // Els alcaldes surten a totes dues fitxes i mana la de J21, que lliga
          // amb el nostre historial oficial; la de J27 omple els altres.
          trajectoria:
            trajectoriaDePersona(fitxaTrajectoria, carrec.nom) ?? quiEsDeWikidata(fitxaCaps, carrec.nom),
          capDeLlista: candidatura,
          mandats: mandatsDe(historial, carrec.nom),
          // El que cobra, de cada pagador que ho publica i sense sumar res:
          // l'ajuntament amb nom i cognoms (Barcelona), l'ajuntament via el
          // Ministeri (l'alcaldia), i els altres ens (diputacions, J14).
          retribucio: souDelAjuntamentDe(dades.retribucions?.ajuntament ?? null, carrec.nom),
          alcaldiaSegonsMinisteri: alcaldiaSegonsMinisteriDe(dades, carrec),
          fontVots: fontDelsVots(dades.mocions),
          ...retribucionsDe(dades, carrec.nom),
        },
        generatedAt,
      ),
      "utf8",
    );
    escrites += 1;
  }
  return escrites;
}


/**
 * Què publica l'ajuntament del càrrec d'aquesta persona.
 *
 * Ja hi era desat i no ho llegia ningú: la mètrica de transparència de
 * retribucions porta una fila per persona amb si hi consta la xifra, la
 * declaració de béns i la resta. S'aparella pel nom normalitzat i, com sempre,
 * si el nom lliga amb més d'una persona no s'hi posa res.
 */
function publicaDe(
  dades: NonNullable<Awaited<ReturnType<typeof loadRadiografia>>>,
  nom: string,
): ContextRegidor["publicaDeLaPersona"] {
  const t = dades.transparenciaRetribucions;
  if (!t) return null;
  const clau = normalizePersonName(nom);
  const iguals = t.carrecs.filter((c) => normalizePersonName(c.nom) === clau);
  if (iguals.length !== 1) return null;
  const seu = iguals[0]!;
  return {
    retribucio: seu.retribucio,
    declaracioBens: seu.declaracioBens,
    dietes: seu.dietes,
    indemnitzacions: seu.indemnitzacions,
    altresRetribucions: seu.altresRetribucions,
    fitxa: seu.fitxa,
    font: { nom: t.font, url: t.url, consultat: t.consultat },
  };
}

/**
 * Els càrrecs d'aquesta persona en un altre ens, i què en cobra.
 *
 * La dada la desa J14 per municipi i fins ara només sortia a la fitxa del
 * poble, en una llista de tots els que en tenen. És de la persona, i per això
 * també va a la seva pàgina. L'aparellament és pel nom normalitzat, i si no
 * lliga amb ningú no s'hi posa res: atribuir a algú el segon sou d'un altre
 * seria el pitjor error possible en una pàgina que porta el seu nom al títol.
 */
function retribucionsDe(
  dades: NonNullable<Awaited<ReturnType<typeof loadRadiografia>>>,
  nom: string,
): { altresCarrecs: ContextRegidor["altresCarrecs"]; avisRetribucions: string | null } {
  const clau = normalizePersonName(nom);
  const altres: ContextRegidor["altresCarrecs"] = [];
  const ensVistos = new Set<string>();
  let avis: string | null = null;

  /*
   * Primer el que publica la diputació que paga (J24): és qui paga qui ho diu,
   * amb l'import anual o amb el motiu de no tenir-ne. El «màxim per
   * assistències» hi viatja com a sostre i mai com a import.
   */
  const diputacions = dades.sousDiputacions;
  if (diputacions) {
    const seves = diputacions.persones.filter((p) => normalizePersonName(p.nom) === clau);
    if (seves.length === 1) {
      const d = seves[0]!.diputacio;
      altres.push({
        ens: d.ens,
        carrec: d.carrec,
        anualBrut: d.retribucioAnualBruta,
        concepte: d.retribucioAnualBruta === null ? null : "retribució anual bruta",
        dedicacio: d.dedicacio,
        motiuSenseImport: d.motiu,
        sostreAssistencies: d.maximPerAssistencies,
        font: { nom: d.font.nom, url: d.font.url, llicencia: d.font.llicencia ?? null, consultat: d.font.consultat ?? null },
      });
      ensVistos.add(normalize(d.ens));
      avis = diputacions.advertiment;
    }
  }

  /*
   * Després, la resta de càrrecs acumulats (J14). Si la diputació ja ha dit el
   * seu, la fila de J14 del mateix ens no es repeteix: serien dues targetes del
   * mateix pagador, i la segona sense l'import que la primera sí que porta.
   */
  const acumulats = dades.carrecsAcumulats;
  if (acumulats) {
    const igual = acumulats.persones.filter((p) => normalizePersonName(p.nom) === clau);
    if (igual.length === 1) {
      for (const a of igual[0]!.altres) {
        if (ensVistos.has(normalize(a.ens))) continue;
        altres.push({
          ens: a.ens,
          carrec: a.carrec,
          anualBrut: a.retribucio?.anualBrut ?? null,
          concepte: a.retribucio?.concepte ?? null,
          dedicacio: a.retribucio?.dedicacio ?? null,
          motiuSenseImport: a.senseRetribucioPublicada?.motiu ?? null,
          font: a.retribucio?.font ?? a.senseRetribucioPublicada?.font ?? null,
        });
        avis ??= acumulats.advertiment;
      }
    }
  }
  return { altresCarrecs: altres, avisRetribucions: altres.length > 0 ? avis : null };
}

/** El que el fitxer de Barcelona desa de cada persona (J22), retallat al que llegim. */
type ElecteAmbSou = {
  nom: string;
  euros: number | null;
  importAmbigu: boolean;
  observacio: string | null;
  grauOcupacio: string | null;
  plenaDedicacio: boolean;
  declaracioBens: string | null;
};
type AjuntamentAmbSous = {
  consultat: string;
  electes: ElecteAmbSou[];
  font: { nom: string; organisme: string; portal: string; llicencia: string; consultat?: string };
};

/** La forma que J22 desa a `retribucions.ajuntament`, que la fitxa del municipi té com a `unknown`. */
function esAjuntamentAmbSous(x: unknown): x is AjuntamentAmbSous {
  if (typeof x !== "object" || x === null) return false;
  const a = x as Partial<AjuntamentAmbSous>;
  return Array.isArray(a.electes) && typeof a.font?.organisme === "string" && typeof a.font?.llicencia === "string";
}

/**
 * El que l'ajuntament que paga publica del sou d'aquesta persona, amb nom i
 * cognoms. Avui només Barcelona ho fa (J22), i és l'única xifra per persona de
 * tot el projecte: per això va amb `abast: "tot"` i es compara amb el salari
 * mínim... quan té any, que el fitxer no en porta. Sense any, sense comparació.
 *
 * El mateix aparellament que la resta: nom normalitzat, i si lliga amb més
 * d'una persona no es diu res. Un zero és el que l'Ajuntament declara pagar,
 * i no s'amaga: el text de la font que l'explica hi va al costat.
 */
export function souDelAjuntamentDe(ajuntament: unknown, nom: string): ContextRegidor["retribucio"] {
  if (!esAjuntamentAmbSous(ajuntament)) return null;
  const clau = normalizePersonName(nom);
  const iguals = ajuntament.electes.filter((e) => normalizePersonName(e.nom) === clau);
  if (iguals.length !== 1) return null;
  const e = iguals[0]!;
  return {
    anualBrut: e.importAmbigu ? null : e.euros,
    abast: "tot",
    paga: ajuntament.font.organisme,
    // El grau d'ocupació ve com a text («100.00»): si és un número es diu com
    // un percentatge, i si no, tal com la font l'escriu.
    dedicacio: e.plenaDedicacio
      ? "plena dedicació"
      : e.grauOcupacio
        ? Number.isFinite(Number(e.grauOcupacio))
          ? `dedicació del ${Number(e.grauOcupacio).toLocaleString("ca-ES")} %`
          : `grau d'ocupació ${e.grauOcupacio}`
        : null,
    any: null,
    motiuSenseImport: e.importAmbigu
      ? "les files de la font no diuen el mateix import per a aquesta persona, i no en triem cap"
      : e.euros === null
        ? "qui el paga no hi escriu cap import per a aquest càrrec"
        : null,
    font: {
      nom: `${ajuntament.font.nom}, dades obertes de l'${ajuntament.font.organisme}`,
      url: ajuntament.font.portal,
      llicencia: ajuntament.font.llicencia,
      consultat: ajuntament.font.consultat ?? ajuntament.consultat ?? null,
    },
    declaracioBens: e.declaracioBens,
    avis: e.observacio,
  };
}

/**
 * El que l'ajuntament declara al Ministeri de la seva alcaldia (J22), només a
 * la pàgina de qui la té.
 *
 * El full del Ministeri no porta el nom de l'alcalde: porta el total que
 * l'ajuntament diu haver pagat a l'alcaldia aquell exercici. Per penjar-lo
 * d'una persona calen dues coses: que el càrrec d'aquesta pàgina sigui
 * l'alcaldia —«alcald…» al davant, i no una tinència, que també ho conté— i
 * que, si sabem qui és l'alcalde pel registre, sigui la mateixa persona. I
 * encara així, si l'alcaldia ha canviat de mans dins del mandat, el total de
 * l'any és de dues persones i no s'atribueix: es diu que no s'atribueix.
 */
export function alcaldiaSegonsMinisteriDe(
  dades: {
    retribucions: NonNullable<Awaited<ReturnType<typeof loadRadiografia>>>["retribucions"];
    mayors: { currentTermChange: unknown } | null;
    municipality: { mayorName: string | null };
  },
  carrec: { nom: string; carrec: string },
): ContextRegidor["alcaldiaSegonsMinisteri"] {
  const ministeri = dades.retribucions?.ministeri ?? null;
  if (!ministeri || !ministeri.alcaldia) return null;
  if (!/^alcald/i.test(carrec.carrec.trim())) return null;
  const alcalde = dades.municipality.mayorName;
  if (alcalde && normalizePersonName(alcalde) !== normalizePersonName(carrec.nom)) return null;
  return {
    any: ministeri.any,
    euros: ministeri.alcaldia.euros,
    regim: ministeri.alcaldia.regim,
    mena: ministeri.alcaldia.mena,
    canviDAlcaldia: dades.mayors?.currentTermChange !== null && dades.mayors?.currentTermChange !== undefined,
    font: {
      nom: ministeri.font.nom,
      organisme: ministeri.font.organisme,
      url: ministeri.font.pagina,
      llicencia: ministeri.font.llicencia,
      consultat: ministeri.font.consultat,
    },
    avis: ministeri.advertiment,
  };
}

/**
 * D'on surten els vots que ensenya la pàgina, per citar-ho al costat.
 *
 * La forma de `mocions` és la de J12 —una font i un URL— i J16 hi afegeix, per
 * a Barcelona, la llicència sencera i la data de descàrrega: aquí es llegeixen
 * si hi són i no s'inventen si no hi són.
 */
function fontDelsVots(
  mocions: NonNullable<Awaited<ReturnType<typeof loadRadiografia>>>["mocions"],
): ContextRegidor["fontVots"] {
  if (!mocions) return null;
  const extra = mocions as {
    llicencia?: { nom?: string; url?: string } | string | null;
    descarregatEl?: string | null;
  };
  const llicencia =
    typeof extra.llicencia === "string"
      ? { nom: extra.llicencia, url: null }
      : extra.llicencia && typeof extra.llicencia === "object"
        ? { nom: extra.llicencia.nom ?? null, url: extra.llicencia.url ?? null }
        : null;
  return {
    nom: mocions.font,
    url: mocions.fontUrl ?? null,
    llicencia: llicencia?.nom ?? null,
    llicenciaUrl: llicencia?.url ?? null,
    consultat: extra.descarregatEl ?? null,
  };
}

/** Una candidatura del 2023 amb la seva gent, tal com la llegeix `carregaCandidatures2023()`. */
export type Candidatura2023 = {
  sigles: string;
  vots: number;
  regidories: number;
  persones: { nom: string; clau: string; posicio: number; capDeLlista: boolean }[];
};

/**
 * Les candidatures proclamades del 2023, per municipi, amb vots i regidories.
 *
 * Es llegeixen totes de cop —43.710 files— i no municipi a municipi: són
 * quatre camps per fila i hi caben a la memòria; 947 consultes no. Només els
 * titulars: els suplents també porten número, però és el d'una altra llista.
 */
async function carregaCandidatures2023(db: Db): Promise<Map<number, Candidatura2023[]>> {
  const files = await db
    .select({
      municipalityId: candidatures.municipalityId,
      candidatureId: candidatures.id,
      sigles: candidatures.sigles,
      vots: electionResults.votes,
      regidories: electionResults.seats,
      nom: people.fullName,
      posicio: candidacies.listPosition,
      capDeLlista: candidacies.isHead,
    })
    .from(candidacies)
    .innerJoin(candidatures, eq(candidatures.id, candidacies.candidatureId))
    .innerJoin(electionResults, eq(electionResults.candidatureId, candidatures.id))
    .innerJoin(people, eq(people.id, candidacies.personId))
    .where(and(eq(candidatures.electionId, ELECCIO_CAPS), eq(candidacies.kind, "Titular")));

  const perCandidatura = new Map<number, Candidatura2023 & { municipalityId: number }>();
  for (const f of files) {
    let llista = perCandidatura.get(f.candidatureId);
    if (llista === undefined) {
      llista = { municipalityId: f.municipalityId, sigles: f.sigles, vots: f.vots, regidories: f.regidories, persones: [] };
      perCandidatura.set(f.candidatureId, llista);
    }
    llista.persones.push({ nom: f.nom, clau: normalizePersonName(f.nom), posicio: f.posicio, capDeLlista: f.capDeLlista });
  }
  const perMunicipi = new Map<number, Candidatura2023[]>();
  for (const { municipalityId, ...llista } of perCandidatura.values()) {
    llista.persones.sort((a, b) => a.posicio - b.posicio);
    const grup = perMunicipi.get(municipalityId);
    if (grup === undefined) perMunicipi.set(municipalityId, [llista]);
    else grup.push(llista);
  }
  return perMunicipi;
}

/**
 * La candidatura amb què aquesta persona es va presentar el 2023, si l'hem
 * pogut lligar, i el que en surt: quants vots, quantes regidories, quina força
 * va ser i si té l'alcaldia.
 *
 * Pel nom normalitzat dins de les llistes del municipi, i si el nom lliga amb
 * més d'una candidatura no es diu res: a una pàgina que porta el nom al títol
 * no s'hi penja la llista d'un homònim. L'alcaldia es resol primer per la
 * persona —l'alcalde que dona el registre és a quina llista— i, si no, per
 * les sigles que dona la mètrica de govern; quan cap de les dues no ho diu,
 * queda `null` i la pàgina no ho afirma ni ho nega.
 */
export function candidatura2023De(
  llistes: readonly Candidatura2023[] | undefined,
  nom: string,
  alcaldia: { nom: string | null; sigles: string | null },
): ContextRegidor["capDeLlista"] {
  if (!llistes || llistes.length === 0) return null;
  const clauNom = normalizePersonName(nom);
  const trobades = llistes.flatMap((llista) =>
    llista.persones.filter((p) => p.clau === clauNom).map((persona) => ({ llista, persona })),
  );
  if (trobades.length !== 1) return null;
  const { llista, persona } = trobades[0]!;

  let teAlcaldia: boolean | null = null;
  const clauAlcalde = alcaldia.nom ? normalizePersonName(alcaldia.nom) : null;
  if (clauAlcalde !== null) {
    const ambElAlcalde = llistes.filter((l) => l.persones.some((p) => p.clau === clauAlcalde));
    if (ambElAlcalde.length === 1) teAlcaldia = ambElAlcalde[0] === llista;
  }
  if (teAlcaldia === null && alcaldia.sigles) {
    const perSigles = llistes.filter((l) => clau(l.sigles) === clau(alcaldia.sigles!));
    if (perSigles.length === 1) teAlcaldia = perSigles[0] === llista;
  }

  return {
    es: persona.capDeLlista,
    posicio: persona.posicio,
    sigles: llista.sigles,
    vots: llista.vots,
    regidories: llista.regidories,
    forca: 1 + llistes.filter((l) => l.vots > llista.vots).length,
    forces: llistes.length,
    vaGuanyar: !llistes.some((l) => l.vots > llista.vots),
    teAlcaldia,
  };
}

/** L'any d'unes municipals a partir de la seva clau: «M20191» → 2019. */
const anyDeLEleccio = (electionId: string): number | null => {
  const m = /^M(\d{4})/.exec(electionId);
  return m ? Number(m[1]) : null;
};

/**
 * El pas de cada persona pels plens i per les llistes d'un municipi, de totes
 * les municipals que tenim ingerides.
 *
 * `eleccions` són les municipals de les quals aquest municipi té el ple al
 * registre: sense això no es pot dir de ningú que sigui el seu primer mandat,
 * perquè el silenci d'un mandat no ingerit no és una absència.
 */
export type HistorialMunicipi = {
  eleccions: number[];
  /** Per nom normalitzat, els anys de les municipals després de les quals ha segut al ple. */
  mandats: Map<string, number[]>;
  /** Per nom normalitzat, els anys de les municipals en què ha anat en una llista com a titular. */
  llistes: Map<string, number[]>;
};

/**
 * Tot l'historial de plens i de llistes, un sol cop per a les 947 fitxes.
 *
 * Avui el registre d'electes i les candidatures només porten el mandat
 * 2023-2027 (comprovat el 30-08-2026: `councillor_mandates` i `candidacies`
 * tenen només files de M20231), de manera que d'aquí no en surt cap frase:
 * amb una sola elecció ingerida no es pot dir de ningú si és el primer mandat
 * o el tercer. El dia que J3 i J4 ingereixin el 2015 i el 2019, aquesta funció
 * no ha de canviar.
 */
async function carregaHistorialMandats(db: Db): Promise<Map<number, HistorialMunicipi>> {
  const perMunicipi = new Map<number, HistorialMunicipi>();
  const de = (municipalityId: number): HistorialMunicipi => {
    let h = perMunicipi.get(municipalityId);
    if (h === undefined) {
      h = { eleccions: [], mandats: new Map(), llistes: new Map() };
      perMunicipi.set(municipalityId, h);
    }
    return h;
  };
  const afegeix = (map: Map<string, number[]>, clau: string, any: number): void => {
    const anys = map.get(clau) ?? [];
    if (!anys.includes(any)) anys.push(any);
    map.set(clau, anys);
  };

  const mandats = await db
    .select({
      municipalityId: councillorMandates.municipalityId,
      electionId: councilTerms.electionId,
      nom: people.fullName,
    })
    .from(councillorMandates)
    .innerJoin(councilTerms, eq(councilTerms.id, councillorMandates.termId))
    .innerJoin(people, eq(people.id, councillorMandates.personId));
  for (const m of mandats) {
    const any = anyDeLEleccio(m.electionId);
    if (any === null) continue;
    const h = de(m.municipalityId);
    if (!h.eleccions.includes(any)) h.eleccions.push(any);
    afegeix(h.mandats, normalizePersonName(m.nom), any);
  }

  const llistes = await db
    .select({
      municipalityId: candidatures.municipalityId,
      electionId: candidatures.electionId,
      nom: people.fullName,
    })
    .from(candidacies)
    .innerJoin(candidatures, eq(candidatures.id, candidacies.candidatureId))
    .innerJoin(people, eq(people.id, candidacies.personId))
    .where(eq(candidacies.kind, "Titular"));
  for (const l of llistes) {
    const any = anyDeLEleccio(l.electionId);
    if (any === null) continue;
    afegeix(de(l.municipalityId).llistes, normalizePersonName(l.nom), any);
  }

  for (const h of perMunicipi.values()) {
    h.eleccions.sort((a, b) => a - b);
    for (const anys of h.mandats.values()) anys.sort((a, b) => a - b);
    for (const anys of h.llistes.values()) anys.sort((a, b) => a - b);
  }
  return perMunicipi;
}

/**
 * Quants mandats porta aquesta persona en aquest ple, i des de quan.
 *
 * Només es diu quan el municipi té al registre **més d'una** municipal: amb
 * una de sola, «primer mandat» seria confondre el que no hem ingerit amb el
 * que no ha passat, i a tots els plens hi ha gent que hi és des de molt abans.
 * `seguits` és cert quan els mandats són les últimes municipals sense cap
 * forat, i `desDe` només afirma un inici quan la municipal anterior a la
 * primera també és al registre: si el registre comença el 2015 i la persona
 * hi és des del 2015, no sabem si hi era el 2011.
 */
export function mandatsDe(historial: HistorialMunicipi | undefined, nom: string): ContextRegidor["mandats"] {
  if (!historial || historial.eleccions.length < 2) return null;
  const clau = normalizePersonName(nom);
  const anys = historial.mandats.get(clau) ?? [];
  if (anys.length === 0) return null;
  const eleccions = historial.eleccions;
  // Si l'últim mandat que li consta no és el de l'última municipal, alguna
  // cosa no lliga —un nom escrit diferent en un dels registres— i val més no
  // dir res que comptar malament.
  if (anys[anys.length - 1] !== eleccions[eleccions.length - 1]) return null;
  const primer = anys[0]!;
  const ultimes = eleccions.slice(eleccions.length - anys.length);
  const seguits = ultimes.length === anys.length && ultimes.every((a, i) => a === anys[i]);
  const iniciConegut = eleccions.some((e) => e < primer);
  const llistesSenseEntrar = (historial.llistes.get(clau) ?? []).filter((a) => !anys.includes(a));
  return {
    anys,
    primer,
    quants: anys.length,
    seguits,
    iniciConegut,
    cobertesDesDe: eleccions[0]!,
    llistesSenseEntrar,
  };
}

/**
 * A quants plens ha anat una persona, si les actes ho diuen.
 *
 * L'aparellament es fa pel nom normalitzat, i si un nom lliga amb més d'una
 * persona de la llista no es diu res: comptar-li a algú les absències d'un altre
 * és el pitjor error possible en una pàgina amb el seu nom al títol.
 */
/**
 * A quants plens ha anat aquesta persona, si ens en podem refiar.
 *
 * La comprovació de plausibilitat no és una precaució genèrica: a les Franqueses
 * del Vallès **els catorze regidors sortien amb «1 de 49 plens»**, l'alcalde
 * inclòs. No era absentisme, és clar; era que la llista d'assistents d'aquelles
 * actes no s'havia sabut llegir. I la diferència importa molt, perquè publicar
 * que un alcalde va assistir a un ple de quaranta-nou no és una dada fluixa: és
 * una acusació, i és falsa.
 *
 * El garbell és la llei. Un ple no es pot constituir sense **quòrum d'un terç
 * dels membres, i mai menys de tres** (art. 46.2.c de la Llei de bases del règim
 * local). Si de les actes en surt que hi havia menys gent que el quòrum, el que
 * és impossible no és el ple: és la nostra lectura. Llavors no es publica res,
 * que és el que la fitxa fa sempre que la dada no aguanta.
 */
/**
 * El nom d'un assistent, sense el càrrec que l'acta li enganxa al darrere.
 *
 * Les llistes d'assistents escriuen «Juan Antonio Corchado Ponce, alcalde» i
 * «Eva Navarrete Bachs, regidora». El nom del ple, en canvi, és només el nom, i
 * la comparació era exacta: **no lligava cap dels bons**. El que lligava era
 * alguna altra variant del mateix nom que apareixia un sol cop, i per això
 * l'alcalde de les Franqueses sortia publicat amb «1 de 49 plens» quan la seva
 * fila de debò en deia 48.
 */
export const nomAssistent = (text: string): string => text.split(",")[0]!.trim();

/**
 * Això sembla el nom d'una persona?
 *
 * Al costat dels assistents de veritat, la lectura de les actes hi cola
 * capçaleres de taula i restes del document: a les Franqueses hi havia «Nom i
 * Cognoms» amb 49 plens —una columna comptada com si fos algú—, i a Esplugues
 * les dues úniques «persones» eren «ACORD ÚNIC.- DICTAMEN QUE PROPOSA» i «El
 * documento ha sido firmado por :». Cap d'aquestes no arriba a la pàgina de
 * ningú, però totes compten al denominador i desplacen la persona bona.
 */
export function semblaUnNom(text: string): boolean {
  const nom = nomAssistent(text);
  if (nom.length < 5 || nom.length > 70) return false;
  if (/[:;.·)(\d]/.test(nom)) return false;
  const mots = nom.split(/\s+/).filter(Boolean);
  if (mots.length < 2 || mots.length > 7) return false;
  // «Nom i Cognoms» és literalment la capçalera de la columna.
  return !/^(nom|nombre)\b/i.test(nom);
}

/**
 * A quants plens ha anat aquesta persona, si ens en podem refiar.
 *
 * Les comprovacions no són una precaució genèrica: a les Franqueses del Vallès
 * **els catorze regidors sortien amb «1 de 49 plens»**, l'alcalde inclòs. No era
 * absentisme; era que la llista d'assistents no s'havia sabut llegir. I la
 * diferència importa molt, perquè publicar que un alcalde va assistir a un ple
 * de quaranta-nou no és una dada fluixa: és una acusació, i és falsa.
 *
 * L'últim garbell és la llei. Un ple no es constitueix sense **quòrum d'un terç
 * dels membres, i mai menys de tres** (art. 46.2.c de la Llei de bases del règim
 * local). Si de les actes en surt que hi havia menys gent que el quòrum, el que
 * és impossible no és el ple: és la nostra lectura, i llavors no es publica res.
 */
function assistenciaDe(
  dades: NonNullable<Awaited<ReturnType<typeof loadRadiografia>>>,
  nom: string,
  regidories: number,
): { hi: number; de: number } | null {
  const assistencia = dades.mocions?.assistencia ?? null;
  if (!assistencia || assistencia.plensAmbLlista < 5) return null;

  const gent = assistencia.persones.filter((p) => semblaUnNom(p.nom));
  if (gent.length === 0) return null;

  const quorum = Math.max(3, Math.ceil(regidories / 3));
  const presentsPerPle = gent.reduce((a, p) => a + p.plens, 0) / assistencia.plensAmbLlista;
  if (presentsPerPle < quorum) return null;

  /*
   * Una persona hi surt sota tantes formes com càrrecs ha tingut.
   *
   * A les Franqueses, Dolors Amaro Fitó hi consta com a «regidora» en 31 plens,
   * com a «tinenta d'alcalde (SPLF)» en 17 i sense càrrec en 1: **31 + 17 + 1 =
   * 49**, que són exactament tots els plens amb llista. No són tres persones ni
   * tres comptes que competeixen: són tres trams de la mateixa persona, i el que
   * val és la suma.
   *
   * Que la suma no pugui passar del nombre de plens és el que ho fa segur, i és
   * la mateixa comprovació que ho valida: si dues formes s'haguessin comptat el
   * mateix dia, la suma se n'aniria per sobre i llavors no en sabem prou per
   * publicar-ho.
   */
  const clau = normalizePersonName(nom);
  const seves = gent.filter((p) => normalizePersonName(nomAssistent(p.nom)) === clau);
  if (seves.length === 0) return null;
  const hi = seves.reduce((a, p) => a + p.plens, 0);
  if (hi > assistencia.plensAmbLlista) return null;
  return { hi, de: assistencia.plensAmbLlista };
}
