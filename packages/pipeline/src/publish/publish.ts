import { mkdir, readdir, readFile, rm, stat, writeFile as writeFileRaw } from "node:fs/promises";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import {
  candidacies, candidatures, electionResults, municipalities,
  municipalityMetrics, people, type Db,
} from "@quivoto/db";
import { loadRadiografia, renderRadiografia } from "./radiografia";
import { escriuAlcaldiesHistoriques, esRedireccioAlcaldia } from "./alcaldia-historica";
import { carregaMedianes } from "./medianes";
import { mitjanesPerGrup } from "./criminalitat";
import { carregaMetriques } from "./metriques";
import { buildPeerGroups } from "../derive/peers";
import { escriuCerca, escriuCercaAlcaldies, escriuCercaElectes } from "./cerca";
import { escriuCercadorCompartit } from "./cercador";
import { carregaSeriesGrup } from "./series-grup";
import { loadEls947, renderEls947 } from "./els947";
import { INDEXABLE, SITE } from "./config";
import { portaNoIndex } from "./seo";
import { loadComarques, renderComarca } from "./comarques";
import { renderComarquesIndex, type ComarcaFila } from "./comarques-index";
import { loadAmb, renderAmb } from "./amb";
import { loadEns } from "./ens-dades";
import { renderEns } from "./ens";
import { renderEnsIndex } from "./ens-index";
import { adrecaEns, type DadesEns } from "./ens-tipus";
import { loadTrajectoriaElectes, renderTrajectoriaElectes } from "./trajectoria-electes";
import { loadComparador, renderComparador } from "./comparador";
import { renderDadesIndex, writeDownloads } from "./dades";
import { clau, loadCandidatures, renderCandidatura } from "./candidatura";
import { loadPartits, renderPartit } from "./partit";
import { renderPartitsIndex } from "./partits-index";
import { fixaXifresPeu, XIFRES_PEU } from "./peu";
import type { CriminalitatMetric } from "../jobs/j29-criminalitat";
import { KIND as KIND_TRAJECTORIA, type FitxaTrajectoria } from "../jobs/j21-trajectoria-electes";
import { ELECCIO as ELECCIO_CAPS, KIND as KIND_CAPS, type FitxaCapsDeLlista } from "../jobs/j27-caps-de-llista";
import { writeOgImages } from "./og";
import { escriuVeins } from "./veins";
import type { PuntMapa } from "./mapa";
import { carregaPreguntes, renderIndexPreguntes, renderPreguntes } from "./preguntes";
import { renderProva } from "./prova";
import { verifica } from "./verificacio";
import { renderPortada } from "./portada";
import { renderMapaCatalunya } from "./mapa-catalunya";
import { renderRanquings } from "./ranquings";
import { renderMunicipals } from "./municipals";
import type { LlistesObertesMetric } from "../jobs/j37-llistes-obertes";
import { loadCuriositats } from "./curiositats";
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

const GOOGLE_TAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-9ZB1XZ3LHT"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-9ZB1XZ3LHT');
</script>`;

/** Cap pàgina HTML generada pot perdre l'analítica en una publicació futura. */
async function writeFile(path: string, data: string | Uint8Array, encoding?: BufferEncoding): Promise<void> {
  const output = path.endsWith(".html") && typeof data === "string" && !data.includes("G-9ZB1XZ3LHT")
    ? data.replace("</head>", `${GOOGLE_TAG}\n</head>`)
    : data;
  await writeFileRaw(path, output, encoding);
}

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
      conjunts.map((c) => [c.slug, { jugable: verifica(c).jugable && c.veredicte.avaluable, quantes: c.afirmacions.length }]),
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
    // Les curiositats dels rànquings: llegeixen l'historial sencer d'alcaldies i
    // les candidatures del 2023, un sol cop per publicació.
    const curiositats = await loadCuriositats(db);
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
    /**
     * I la seguretat, pel mateix motiu que les medianes: la mediana del grup i
     * el «quants tenen dada» del rànquing només es poden saber havent llegit
     * tots els municipis que el Ministeri publica. Els que no hi són reben el
     * bloc igualment —amb el buit dit clar—, i per això a cada fitxa li arriba
     * el grup i el compte, no la mètrica d'un altre.
     */
    const filesCriminalitat = await carregaMetriques(db, ["criminalitat"]);
    const grupsMida = buildPeerGroups(
      await db.select({ id: municipalities.id, population: municipalities.population }).from(municipalities),
    );
    const medianesCriminalitat = mitjanesPerGrup(
      filesCriminalitat.map((f) => ({ municipalityId: f.municipalityId, data: f.data as CriminalitatMetric })),
      grupsMida,
    );
    await mkdir(`${OUT_DIR}../mapa`, { recursive: true });
    await writeFile(`${OUT_DIR}../mapa/index.html`, renderMapaCatalunya(carregats, generatedAt, await loadVotsPartit(db)), "utf8");
    run.say(`mapa de Catalunya amb ${carregats.length} municipis`);
    /*
     * Les diputacions i els consells comarcals (J38), carregats un sol cop i
     * abans de cap pàgina que en parli.
     *
     * Van aquí, abans del cercador, del bucle dels municipis i de les comarques,
     * per dues raons. La primera és que no només tenen fitxa pròpia: la fitxa de cada
     * municipi diu a quina diputació i a quin consell pertany, la de cada
     * comarca enllaça el seu consell i la de cada persona del ple diu si també
     * hi seu. Totes aquestes pàgines reben la mateixa llista, que és l'única
     * manera que el que diu una fitxa i el que diu l'altra no divergeixin. La
     * segona és la de sempre amb PGlite: la lectura es fa amb el motor acabat
     * d'obrir, i no al final d'una sessió de milers de pàgines.
     *
     * Si la J38 no ha corregut mai, la llista és buida i tot continua: les
     * fitxes que l'haurien d'enllaçar callen, i les de l'ens no s'escriuen.
     */
    const ensSupramunicipals: readonly DadesEns[] = await loadEns(db);
    const quantesDiputacions = ensSupramunicipals.filter((e) => e.tipus === "diputacio").length;
    const quantsConsells = ensSupramunicipals.filter((e) => e.tipus === "consell").length;
    run.say(
      ensSupramunicipals.length > 0
        ? `ens supramunicipals: ${quantesDiputacions} diputacions i ${quantsConsells} consells comarcals`
        : "sense ens supramunicipals: cap diputació ni consell desat (falta J38)",
    );

    // L'índex del cercador, al costat del mapa i pel mateix motiu: es fa amb
    // la consulta dels 947 acabada de llegir i no la torna a demanar.
    const quants = await escriuCerca(carregats, `${OUT_DIR}../cerca.json`, ensSupramunicipals);
    run.say(`índex de cerca amb ${quants} municipis`);
    // El cercador mateix —guió, full i diàleg— com a fitxers a /assets/, per a la landing.
    await escriuCercadorCompartit(`${OUT_DIR}../../assets/`);
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
    /*
     * El tercer: qui ha tingut l'alcaldia des del 1979 i avui no seu al ple.
     * A part del segon perquè són tantes files com regidors per a la pregunta
     * que menys gent fa; el navegador se'l baixa darrere de l'altre. No compten
     * al peu: els «electes» del peu són els d'ara.
     */
    const exalcaldies = await escriuCercaAlcaldies(db, carregats, `${OUT_DIR}../cerca-alcaldies.json`);
    run.say(`índex d'alcaldies amb ${exalcaldies} persones que han tingut l'alcaldia i avui no seuen al ple`);


    // El peu de cada pàgina ensenya el que s'ha comptat en aquesta publicació i
    // no una xifra escrita a mà que envelleix sola. Va aquí perquè la primera
    // pàgina que s'escriu ja el porti bo.
    fixaXifresPeu({
      municipis: carregats.length,
      electes: electes.regidors,
      candidatures: electes.candidatures,
      fitxersDades: XIFRES_PEU.fitxersDades,
    });
    // Les mateixes xifres, en un fitxer, perquè la landing (que es genera a
    // part, amb `tools/build_landing.py`) escrigui el mateix peu sense copiar
    // cap número a mà. Les diputacions i els consells hi van com a `null` si la
    // J38 no ha corregut: no és que n'hi hagi zero, és que no ho sabem.
    const senseEns = ensSupramunicipals.length === 0;
    await writeFile(
      `${OUT_DIR}../xifres.json`,
      `${JSON.stringify({
        municipis: carregats.length,
        electes: electes.regidors,
        candidatures: electes.candidatures,
        diputacions: senseEns ? null : quantesDiputacions,
        consells: senseEns ? null : quantsConsells,
        generatedAt,
      })}\n`,
      "utf8",
    );
    // Els rànquings porten el peu global: s'escriuen després de fixar-ne els
    // recomptes, com la resta de la publicació.
    await mkdir(`${OUT_DIR}../ranquings`, { recursive: true });
    await writeFile(`${OUT_DIR}../ranquings/index.html`, renderRanquings(carregats, generatedAt, curiositats), "utf8");
    run.say("pàgina de rànquings");

    /*
     * La pàgina «Com funcionen les municipals»: calendari, qui pot votar i com
     * es reparteixen les regidories. L'única dada que llegeix de la base són
     * els municipis que el 2023 van votar en consell obert (una sola
     * regidoria, l'alcaldia, segons J37), per anomenar-los i enllaçar-los.
     */
    const consellObert = (
      await db
        .select({ slug: municipalities.slug, nom: municipalities.name, data: municipalityMetrics.data })
        .from(municipalityMetrics)
        .innerJoin(municipalities, eq(municipalities.id, municipalityMetrics.municipalityId))
        .where(eq(municipalityMetrics.kind, "llistesObertes"))
    )
      .filter((f) => {
        const darrera = (f.data as LlistesObertesMetric).eleccions?.at(-1);
        return darrera?.any === 2023 && darrera.regidors === 1;
      })
      .map((f) => ({ slug: f.slug, nom: f.nom }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
    await mkdir(`${OUT_DIR}../municipals`, { recursive: true });
    await writeFile(`${OUT_DIR}../municipals/index.html`, renderMunicipals(generatedAt, { consellObert }), "utf8");
    run.say("pàgina de les municipals");

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
    let alcaldiesEscrites = 0;
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
        {
          grup: medianesCriminalitat.get(grupsMida.get(data.municipality.id)?.key ?? "") ?? null,
          coberts: filesCriminalitat.length > 0 ? filesCriminalitat.length : null,
        },
        // La diputació i el consell del municipi: la fitxa els busca a la
        // llista pel seu slug (`ensDeMunicipi`).
        ensSupramunicipals,
        // Les files dels 947, ja carregades per al mapa: «Els teus veïns» hi
        // busca la xifra de cada municipi que toca de terme.
        carregats,
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
        ensSupramunicipals,
      );
      // I les de qui ha tingut l'alcaldia des del 1979, una per persona, a
      // `m/<slug>/alcaldia/<persona>/`. Wikidata (J21) hi posa la trajectòria.
      alcaldiesEscrites += await escriuAlcaldiesHistoriques(
        db,
        OUT_DIR,
        data,
        slug,
        generatedAt,
        trajectoriaPerMunicipi.get(data.municipality.id) ?? null,
      );
      if (!all) run.say(`${data.municipality.name} → observatori/m/${slug}/ (${Math.round(html.length / 1024)} kB)`);
      done.push(slug);
      run.rowsOut += 1;
    }

    if (all) run.say(`${done.length} radiografies generades`);
    run.say(`${regidorsEscrits} fitxes de regidor`);
    run.say(`${alcaldiesEscrites} fitxes d'alcaldia històrica`);

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
      await writeFile(`${OUT_DIR}../c/${slug}/index.html`, renderComarca(comarca, generatedAt, ensSupramunicipals), "utf8");
      filesComarques.push({
        slug,
        name: comarca.name,
        municipis: comarca.municipis.length,
        habitants: comarca.habitants,
        forces: comarca.forces,
        pacte: comarca.pacte,
        canvisAlcaldia: comarca.canvisAlcaldia,
        poblacioMediana: comarca.poblacioMediana,
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
        ensSupramunicipals,
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
    // Qui toca de terme amb qui, calculat de la mateixa geometria que el mapa:
    // és la base del bloc «Els teus veïns» i una dada que algú altre pot voler
    // reutilitzar sense refer el càlcul.
    const veins = await escriuVeins(`${OUT_DIR}../dades/veins.json`);
    run.say(`veïns de terme de ${Object.keys(veins.veins).length} municipis`);

    // Una imatge social per municipi: amb la mateixa per a tots, res del que es
    // comparteix diu de quin poble parla.
    const og = await writeOgImages(db, `${OUT_DIR}../og`, all ? undefined : done, ensSupramunicipals);
    run.say(`${og.images} imatges socials (${Math.round(og.bytes / 1024)} kB)`);

    /*
     * Les fitxes de les quatre diputacions i dels consells comarcals, i el seu
     * índex. Van al costat de l'AMB perquè són el mateix tipus de pàgina: un ens
     * que decideix per sobre de l'ajuntament i que el veí no tria directament.
     *
     * L'adreça la dona `adrecaEns()` i no s'escriu aquí: el consell viu dins
     * de la seva comarca (`c/<slug>/consell/`), i si l'adreça es calculés a dos
     * llocs, l'enllaç de la comarca i la pàgina mateixa podrien no trobar-se.
     *
     * Van després de les imatges socials: `imatgeSocial()` mira si el fitxer
     * existeix quan es pinta la pàgina, i abans d'aquest punt la de cada ens
     * encara no s'ha generat (la primera publicació apuntava a la genèrica).
     *
     * Sense J38 no s'escriu res, com passa amb l'AMB sense J17: un índex buit
     * diria «no n'hi ha cap», i el que passa és que encara no ho sabem.
     */
    if (ensSupramunicipals.length > 0) {
      for (const ens of ensSupramunicipals) {
        const dir = `${OUT_DIR}../${adrecaEns(ens.tipus, ens.slug)}`;
        await mkdir(dir, { recursive: true });
        await writeFile(`${dir}index.html`, renderEns(ens, generatedAt), "utf8");
      }
      // L'índex necessita els 947 per dir de cada municipi a quina diputació i
      // a quin consell pertany: una consulta lleugera, quatre columnes.
      const municipisEns = await db
        .select({
          slug: municipalities.slug,
          nom: municipalities.name,
          comarca: municipalities.comarca,
          provincia: municipalities.provincia,
        })
        .from(municipalities);
      await mkdir(`${OUT_DIR}../ens`, { recursive: true });
      await writeFile(`${OUT_DIR}../ens/index.html`, renderEnsIndex(ensSupramunicipals, municipisEns, generatedAt), "utf8");
      run.say(`${quantesDiputacions} fitxes de diputació, ${quantsConsells} de consell comarcal i el seu índex`);
    }

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
        if (!estat.jugable || !conjunt.veredicte.avaluable) {
          const motiu = estat.motiu ?? conjunt.veredicte.incompliments.find((i) => i.gravetat === "bloqueja")?.detall ?? "no supera el llindar editorial";
          // Si abans superava el llindar, no pot quedar una demostració vella
          // publicada després d'haver-la retirat de l'índex.
          await rm(`${OUT_DIR}../preguntes/${conjunt.slug}/prova`, { recursive: true, force: true });
          run.say(`  ${conjunt.municipi}: sense demostració (${motiu})`);
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

    /*
     * Sitemaps i `llms.txt`: es generen sempre i `robots.txt` els enllaça
     * sempre. Amb `QUIVOTO_NOINDEX=1` les pàgines porten `noindex` i el
     * cercador les deixa estar encara que hi siguin; els sitemaps es fan igual
     * perquè la publicació que torni a obrir no hagi de tocar res més. El que
     * sí que en queda fora és el que porta `noindex` de pàgina —les
     * demostracions de les preguntes i els conjunts «en revisió»—: un sitemap
     * que apunta a pàgines tancades és un avís a Search Console, i es llegeix
     * del HTML de disc perquè la decisió és de cada plantilla.
     *
     * Hi va tot el que hi ha publicat A DISC, no només el que s'acaba
     * d'escriure: una publicació parcial (`--slug`) no pot fer desaparèixer del
     * sitemap els altres 940 municipis. Per això les fitxes de persona i de
     * candidatura es llegeixen del directori de cada municipi.
     *
     * ## El `lastmod` diu quan ha canviat el contingut, no el fitxer
     *
     * Abans era la data del fitxer, i cada publicació els reescriu tots: les
     * 18.000 adreces deien «avui» cada vegada, i un `lastmod` que sempre és avui
     * és el que Google aprèn a ignorar per a tot el lloc. Ara cada adreça guarda
     * l'empremta del que la pàgina diu (`empremtaPagina()` a `seo.ts`, sense la
     * data de generació, el peu ni els estils) i el dia que va canviar per
     * última vegada, a `web/private/data/sitemap-empremtes.json` (fora del web
     * servit i fora de git). Si l'empremta és la mateixa, el `lastmod` també.
     * Un fitxer que aquesta publicació no ha tocat (el mateix `mtime`) ni es
     * torna a llegir. La portada i la llista dels 947 s'escriuen després
     * d'aquest bloc: el seu `lastmod` va una publicació endarrerit.
     *
     * ## Un sitemap per tipus, sempre
     *
     * `sitemap.xml` és un índex que apunta a `sitemap-seccions.xml`,
     * `-ens.xml`, `-municipis.xml`, `-candidatures.xml` i `-persones.xml`. Cap
     * no s'acosta al límit del protocol (50.000 adreces), però separats Search
     * Console diu quantes fitxes de persona s'han indexat i quantes de
     * municipi, que és el que cal saber. Ja no porten `priority`: ni Google ni
     * Bing no en fan cas. L'adreça que coneix `robots.txt` no canvia.
     */
    const OBS = `${SITE}/observatori`;
    const sitemaps = await import("./seo");
    type AdrecaSitemap = import("./seo").AdrecaSitemap;
    type Empremta = import("./seo").Empremta;
    type Pendent = { loc: string; fitxer: string };
    const fitxaDe = (cami: string, fitxer = `${OUT_DIR}../${cami}index.html`): Pendent => ({ loc: `${OBS}/${cami}`, fitxer });
    /** Subdirectoris d'un directori que tenen `index.html`, en ordre de nom. */
    const fillsAmbFitxa = async (dir: string): Promise<string[]> => {
      let noms: string[];
      try {
        noms = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
      } catch {
        return [];
      }
      const amb: string[] = [];
      for (const nom of noms.sort()) {
        try {
          if ((await stat(`${dir}/${nom}/index.html`)).isFile()) amb.push(nom);
        } catch {
          /* un directori sense fitxa (escuts, fotos…) no és cap pàgina */
        }
      }
      return amb;
    };

    const seccions: Pendent[] = [
      fitxaDe(""),
      fitxaDe("els947.html", `${OUT_DIR}../els947.html`),
      ...["mapa/", "ranquings/", "municipals/", "dades/", "comparador/", "partit/"].map((cami) => fitxaDe(cami)),
      ...partits.map((p) => fitxaDe(`partit/${p.id}/`)),
      fitxaDe("c/"),
      ...filesComarques.map((c) => fitxaDe(`c/${c.slug}/`)),
      ...(amb ? [fitxaDe("amb/")] : []),
      ...(trajectoria ? [fitxaDe("trajectoria/")] : []),
    ];
    if (preguntes.length > 0) {
      seccions.push(fitxaDe("preguntes/"));
      for (const conjunt of preguntes) {
        // El conjunt «en revisió» porta `noIndex` propi (vegeu `preguntes.ts`)
        // i no hi va. Només quan l'Observatori és obert: tancat, totes el
        // porten i el sitemap ha de continuar sencer. La demostració (`prova/`)
        // no s'indexa mai.
        const fitxer = `${OUT_DIR}../preguntes/${conjunt.slug}/index.html`;
        if (INDEXABLE && portaNoIndex(await readFile(fitxer, "utf8"))) continue;
        seccions.push(fitxaDe(`preguntes/${conjunt.slug}/`, fitxer));
      }
    }
    // Les diputacions i els consells, al seu propi sitemap. Només si s'han
    // escrit en aquesta publicació (vegeu més amunt).
    const ensSitemap: Pendent[] =
      ensSupramunicipals.length > 0
        ? [
            fitxaDe("ens/"),
            ...[...ensSupramunicipals]
              .sort((x, y) => (x.tipus === y.tipus ? 0 : x.tipus === "diputacio" ? -1 : 1))
              .map((e) => fitxaDe(adrecaEns(e.tipus, e.slug))),
          ]
        : [];
    const municipis: Pendent[] = [];
    const candidaturesSitemap: Pendent[] = [];
    const persones: Pendent[] = [];
    for (const slug of publicades) {
      municipis.push(fitxaDe(`m/${slug}/`, `${OUT_DIR}${slug}/index.html`));
      for (const fill of await fillsAmbFitxa(`${OUT_DIR}${slug}`)) {
        if (fill === "regidor") continue;
        candidaturesSitemap.push(fitxaDe(`m/${slug}/${fill}/`, `${OUT_DIR}${slug}/${fill}/index.html`));
      }
      for (const persona of await fillsAmbFitxa(`${OUT_DIR}${slug}/regidor`)) {
        persones.push(fitxaDe(`m/${slug}/regidor/${persona}/`, `${OUT_DIR}${slug}/regidor/${persona}/index.html`));
      }
      // Les alcaldies històriques van amb les persones. La de qui hi és avui és
      // una redirecció a la seva fitxa de regidor i no hi va.
      for (const persona of await fillsAmbFitxa(`${OUT_DIR}${slug}/alcaldia`)) {
        const fitxer = `${OUT_DIR}${slug}/alcaldia/${persona}/index.html`;
        if (esRedireccioAlcaldia(await readFile(fitxer, "utf8"))) continue;
        persones.push(fitxaDe(`m/${slug}/alcaldia/${persona}/`, fitxer));
      }
    }

    // El `lastmod` de debò de cada adreça (vegeu el comentari de dalt).
    const FITXER_EMPREMTES = `${OUT_DIR}../../../private/data/sitemap-empremtes.json`;
    let anteriors: Record<string, Empremta> = {};
    try {
      anteriors = JSON.parse(await readFile(FITXER_EMPREMTES, "utf8")) as Record<string, Empremta>;
    } catch {
      /* la primera publicació amb empremtes: tot surt datat avui */
    }
    const noves: Record<string, Empremta> = {};
    let rellegides = 0;
    const lastmod = async (p: Pendent): Promise<AdrecaSitemap> => {
      let mtime: number;
      try {
        mtime = (await stat(p.fitxer)).mtimeMs;
      } catch {
        // Encara no hi és (la portada, la primera vegada): avui, com abans.
        return { loc: p.loc, lastmod: generatedAt };
      }
      const abans = anteriors[p.loc];
      if (abans && abans.t === mtime) {
        noves[p.loc] = abans;
        return { loc: p.loc, lastmod: abans.d };
      }
      rellegides++;
      const h = sitemaps.empremtaPagina(await readFile(p.fitxer, "utf8"), generatedAt);
      const d = sitemaps.lastmodReal(abans, h, generatedAt);
      noves[p.loc] = { h, d, t: mtime };
      return { loc: p.loc, lastmod: d };
    };
    /** Les adreces d'una llista amb el seu `lastmod`, de 32 en 32 fitxers alhora. */
    const ambLastmod = async (llista: readonly Pendent[]): Promise<AdrecaSitemap[]> => {
      const sortida: AdrecaSitemap[] = new Array(llista.length);
      let seguent = 0;
      await Promise.all(
        Array.from({ length: Math.min(32, llista.length) }, async () => {
          while (seguent < llista.length) {
            const i = seguent++;
            sortida[i] = await lastmod(llista[i]!);
          }
        }),
      );
      return sortida;
    };

    const grups: [string, AdrecaSitemap[]][] = [];
    for (const [nom, llista] of [
      ["seccions", seccions],
      ["ens", ensSitemap],
      ["municipis", municipis],
      ["candidatures", candidaturesSitemap],
      ["persones", persones],
    ] as const) {
      if (llista.length > 0) grups.push([nom, await ambLastmod(llista)]);
    }
    // Límit del protocol: 50.000 adreces per fitxer. Cap grup no hi arriba,
    // però si un dia ho fa, es parteix en `-2`, `-3`… sense tocar res més.
    const fitxers: { nom: string; adreces: AdrecaSitemap[] }[] = grups.flatMap(([nom, adreces]) =>
      Array.from({ length: Math.ceil(adreces.length / 45_000) }, (_, i) => ({
        nom: i === 0 ? nom : `${nom}-${i + 1}`,
        adreces: adreces.slice(i * 45_000, (i + 1) * 45_000),
      })),
    );
    for (const f of fitxers) await writeFile(`${OUT_DIR}../sitemap-${f.nom}.xml`, sitemaps.urlsetXml(f.adreces), "utf8");
    await writeFile(
      `${OUT_DIR}../sitemap.xml`,
      sitemaps.indexSitemapsXml(
        fitxers.map((f) => ({ loc: `${OBS}/sitemap-${f.nom}.xml`, lastmod: sitemaps.lastmodMesRecent(f.adreces, generatedAt) })),
      ),
      "utf8",
    );
    // Que no quedin sitemaps orfes d'un grup que ja no hi és.
    const escrits = new Set(fitxers.map((f) => `sitemap-${f.nom}.xml`));
    for (const nom of await readdir(`${OUT_DIR}..`)) {
      if (/^sitemap-.+\.xml$/.test(nom) && !escrits.has(nom)) await rm(`${OUT_DIR}../${nom}`, { force: true });
    }
    await mkdir(`${OUT_DIR}../../../private/data`, { recursive: true });
    await writeFile(FITXER_EMPREMTES, JSON.stringify(noves), "utf8");

    // `llms.txt` i `llms-full.txt` a l'arrel del web, amb les mateixes llistes.
    const { escriuLlms } = await import("./llms");
    const enDisc = new Set(publicades);
    const mides = await escriuLlms(`${OUT_DIR}../../`, {
      generatedAt,
      municipis: carregats
        .filter((f) => enDisc.has(f.s))
        .map((f) => ({ slug: f.s, nom: f.n, comarca: f.c || null, regidories: f.r || null, alcaldia: f.a, sigles: f.g })),
      comarques: filesComarques.map((c) => ({ slug: c.slug, nom: c.name })),
      partits: partits.map((p) => ({ id: p.id, nom: p.name, sigles: p.sigles })),
      ens: ensSupramunicipals.map((e) => ({ tipus: e.tipus, slug: e.slug, nom: e.nom })),
      amb: Boolean(amb),
      trajectoria: Boolean(trajectoria),
      candidatures: candidaturesSitemap.length,
      persones: persones.length,
    });

    const total = grups.reduce((s, [, l]) => s + l.length, 0);
    const avui = grups.reduce((s, [, l]) => s + l.filter((a) => a.lastmod === generatedAt).length, 0);
    run.say(
      `sitemap amb ${total} adreces en ${fitxers.length} fitxers (${municipis.length} municipis · ${ensSitemap.length} ens · ${candidaturesSitemap.length} candidatures · ${persones.length} persones); ${avui} han canviat avui, ${rellegides} fitxers rellegits · llms.txt ${Math.round(mides.curt / 1024)} kB i llms-full.txt ${Math.round(mides.sencer / 1024)} kB · ${INDEXABLE ? "indexable" : "TANCAT amb noindex (QUIVOTO_NOINDEX=1)"}`,
    );

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
          partits: partits.filter((p) => !p.historica).length,
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
        ensSupramunicipals,
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
export function grupsDelPle(dades: NonNullable<Awaited<ReturnType<typeof loadRadiografia>>>): Grup[] {
  const carrecs = dades.carrecs?.carrecs ?? [];
  const regidors = dades.councillors;
  if (regidors.length === 0 && carrecs.length === 0) return [];

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

  const nomsGovern = new Set(carrecs.filter((c) => c.equipGovern).map((c) => normalizePersonName(c.nom)));
  const grupsGovern = carrecs.filter((c) => c.equipGovern && c.grup).map((c) => c.grup!);
  const per = new Map<string, { escons: number; govern: number; sigles: Map<string, number>; colors: Map<string, number> }>();

  // El registre electoral és el cens complet del ple. La seu només l'enriqueix
  // amb la pertinença al govern; mai no pot fer desaparèixer un grup.
  for (const c of regidors) {
    const nom = c.groupName ?? c.sigles ?? "Sense grup";
    const acumulat = per.get(nom) ?? { escons: 0, govern: 0, sigles: new Map<string, number>(), colors: new Map<string, number>() };
    acumulat.escons += 1;
    if (nomsGovern.has(normalizePersonName(c.name)) || grupsGovern.some((g) => sameForce(g, nom))) acumulat.govern += 1;
    if (c.sigles !== null) acumulat.sigles.set(c.sigles, (acumulat.sigles.get(c.sigles) ?? 0) + 1);
    if (c.color !== null) acumulat.colors.set(c.color, (acumulat.colors.get(c.color) ?? 0) + 1);
    per.set(nom, acumulat);
  }

  // Fallback per a una base antiga sense mandats electorals: conserva el que
  // publiqui la seu, però només en aquest cas.
  if (regidors.length === 0) for (const c of carrecs) {
    const nom = c.grup ?? "Sense grup";
    const acumulat = per.get(nom) ?? { escons: 0, govern: 0, sigles: new Map<string, number>(), colors: new Map<string, number>() };
    acumulat.escons += 1;
    if (c.equipGovern) acumulat.govern += 1;
    const sigles = siglesPerPersona.get(normalizePersonName(c.nom));
    if (sigles !== undefined) acumulat.sigles.set(sigles, (acumulat.sigles.get(sigles) ?? 0) + 1);
    per.set(nom, acumulat);
  }

  // Els noms institucionals i les sigles electorals poden ser molt diferents
  // ("Partit Popular" / "PP"). Fem servir el mateix encaix prudent que amb
  // les actes per traslladar la marca de govern al grup electoral complet.
  const grupsProvisionals: Grup[] = [...per.entries()].map(([nom, x]) => ({
    nom,
    sigles: [...x.sigles.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    escons: x.escons,
    govern: false,
    color: [...x.colors.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  }));
  const governPerGrup = new Set(
    grupsGovern.map((nom) => encaixa(nom, grupsProvisionals)?.nom).filter((nom): nom is string => nom !== undefined),
  );

  return [...per.entries()].map(([nom, { escons, govern, sigles, colors }]) => {
    // Les sigles del grup són les de la majoria dels seus membres: si un ha
    // canviat de grup a mig mandat, no ha d'arrossegar tot el grup.
    const majoritaries = [...sigles.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    return {
      nom,
      sigles: majoritaries && majoritaries[1] > escons / 2 ? majoritaries[0] : null,
      escons,
      // La majoria protegeix contra una errata puntual de nom entre fonts
      // (Badalona publica Sheila/Shelia) sense convertir un trànsfuga aïllat en
      // tot un grup de govern.
      govern: governPerGrup.has(nom) || govern > escons / 2,
      color: [...colors.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    };
  }).sort((a, b) => b.escons - a.escons || a.nom.localeCompare(b.nom, "ca"));
}


/** Un punt del ple tal com el desa J12, retallat al que llegeix `votsPerGrupDe`. */
export type PuntDelPle = {
  data: string;
  titol: string;
  url: string;
  vots: { grup: string; sentit: string; vots: number | null }[];
};

/**
 * Els vots de cada grup, una sola vegada per municipi i no un cop per persona.
 *
 * `tot` diu si el grup hi va votar sencer, que és el que permet atribuir el
 * vot a cada persona: si un grup de divuit regidories hi posa divuit vots, no
 * queda ningú a qui atribuir un vot diferent. Quan l'acta no dona la xifra,
 * l'adaptador ja ho llegeix com «tot el grup»; quan en dona menys que
 * regidories, algú no hi era o va votar a part i no es pot dir qui.
 *
 * El lligam del nom que escriu l'acta («PSC», «Esplugues en Comú Podem») amb
 * el grup del ple («Partit dels Socialistes de Catalunya - Candidatura de
 * Progrés (PSC-CP)») el fa `encaixa`, que davant del dubte no lliga res: a la
 * pàgina d'una persona, atribuir-li el vot d'un altre grup és el pitjor error
 * possible. I `puntsAmbDesglos` compta els punts on hem reconegut ALGUN grup
 * del ple, que és el que permet a la pàgina distingir «no n'hem sabut llegir
 * cap vot per grup» de «n'hem llegit però no hem sabut reconèixer el seu».
 */
export function votsPerGrupDe(
  punts: readonly PuntDelPle[],
  grups: readonly Grup[],
): { votsPerGrup: Map<string, ContextRegidor["votsDelGrup"]>; puntsAmbDesglos: number } {
  const escons = new Map(grups.map((g) => [g.nom, g.escons]));
  const votsPerGrup = new Map<string, ContextRegidor["votsDelGrup"]>();
  let puntsAmbDesglos = 0;
  for (const punt of punts) {
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
    let lligat = false;
    for (const vot of punt.vots) {
      if (vot.sentit !== "favor" && vot.sentit !== "contra" && vot.sentit !== "abstencio") continue;
      const grup = encaixa(vot.grup, grups);
      if (grup === null) continue;
      lligat = true;
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
    if (lligat) puntsAmbDesglos += 1;
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
  return { votsPerGrup, puntsAmbDesglos };
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
  /** Les diputacions i els consells (J38), per dir si la persona també hi seu. */
  ens: readonly DadesEns[] = [],
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

  const { votsPerGrup, puntsAmbDesglos } = votsPerGrupDe(dades.mocions?.llista ?? [], grups);

  const totalSeats = carrecs.length;
  let escrites = 0;
  const adreces = adrecesRegidors(carrecs);
  /*
   * Les persones de cada grup, per al bloc «Al mateix grup» de la fitxa de
   * cadascuna: la mateixa llista i el mateix ordre que la fitxa municipal, i
   * l'adreça és la que ja s'ha decidit aquí i no es recalcula a la pàgina.
   * La foto petita (160 px) és la que toca per a una cara de 40 px.
   */
  const perGrup = new Map<string, NonNullable<ContextRegidor["companys"]>>();
  for (const c of carrecs) {
    if (!c.grup) continue;
    const llista = perGrup.get(c.grup) ?? [];
    llista.push({ nom: c.nom, foto: c.fotoPetita ?? c.foto, adreca: adreces.get(c)!, carrec: c.carrec });
    perGrup.set(c.grup, llista);
  }
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
          actesIndexades: dades.mocions?.actes.indexades ?? null,
          puntsAmbDesglos,
          assistencia: assistenciaDe(dades, carrec.nom, totalSeats),
          adreca: adreces.get(carrec)!,
          comarca: dades.municipality.comarca ?? null,
          companys: carrec.grup ? perGrup.get(carrec.grup) ?? null : null,
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
          llistes: llistesDe(historial, carrec.nom),
          // El que cobra, de cada pagador que ho publica i sense sumar res:
          // l'ajuntament amb nom i cognoms (Barcelona), l'ajuntament via el
          // Ministeri (l'alcaldia), i els altres ens (diputacions, J14).
          retribucio: souDelAjuntamentDe(dades.retribucions?.ajuntament ?? null, carrec.nom),
          alcaldiaSegonsMinisteri: alcaldiaSegonsMinisteriDe(dades, carrec),
          fontVots: fontDelsVots(dades.mocions),
          ...retribucionsDe(dades, carrec.nom),
        },
        generatedAt,
        ens,
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
   * El mateix, del consell comarcal que paga (J30): la mateixa forma i les
   * mateixes regles que J24. El cas que ho va demanar: una regidora de
   * Vallirana, presidenta del Consell Comarcal del Baix Llobregat amb sou
   * publicat a la seu del consell, que la seva pàgina no deia.
   */
  const delConsell = souDelConsellDe(dades.sousConsells ?? null, nom);
  if (delConsell !== null && !ensVistos.has(normalize(delConsell.carrec.ens))) {
    altres.push(delConsell.carrec);
    ensVistos.add(normalize(delConsell.carrec.ens));
    avis ??= delConsell.advertiment;
    // El nom tal com l'escriu el consell, quan no és el nostre lletra per
    // lletra: qui vagi a comprovar la font l'ha de poder reconèixer.
    if (delConsell.nota !== null) avis = avis === null ? delConsell.nota : `${avis} ${delConsell.nota}`;
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

/** El que J30 desa per municipi, retallat al que en llegeix la fitxa de persona. */
type SousConsellsDeJ30 = {
  persones: {
    nom: string;
    /** El nom tal com l'escriu el consell, quan no és lletra per lletra el mateix. */
    nomAlConsell?: string | null;
    consell: {
      ens: string;
      carrec: string;
      dedicacio: string | null;
      retribucioAnualBruta: number | null;
      maximPerAssistencies: number | null;
      motiu: string | null;
      font: { nom: string; url: string; llicencia?: string | null; consultat?: string | null };
    };
  }[];
  advertiment?: string | null;
};

/** La forma que J30 desa a la mètrica `sousConsells`, llegida sense refiar-se'n. */
function esSousConsells(x: unknown): x is SousConsellsDeJ30 {
  if (typeof x !== "object" || x === null) return false;
  return Array.isArray((x as Partial<SousConsellsDeJ30>).persones);
}

/**
 * El càrrec al consell comarcal d'aquesta persona, amb el que en publica el
 * consell que el paga (J30). Les regles són les de sempre i no es relaxen:
 * l'aparellament és pel nom normalitzat i dos noms iguals no diuen res; només
 * viatja l'import que publica qui paga; i el màxim per assistències va com a
 * sostre, mai com a sou —no s'apunta a `anualBrut` ni se suma amb res.
 *
 * `nota` diu com escriu el nom el consell quan no és lletra per lletra el
 * nostre («Eva M. Martínez Morales»): qui vagi a la font ha de poder
 * reconèixer que parlem de la mateixa persona.
 */
export function souDelConsellDe(
  sousConsells: unknown,
  nom: string,
): {
  carrec: ContextRegidor["altresCarrecs"][number];
  advertiment: string | null;
  nota: string | null;
} | null {
  if (!esSousConsells(sousConsells)) return null;
  const clau = normalizePersonName(nom);
  const seves = sousConsells.persones.filter(
    (p) => p?.consell && typeof p.nom === "string" && normalizePersonName(p.nom) === clau,
  );
  if (seves.length !== 1) return null;
  const persona = seves[0]!;
  const c = persona.consell;
  const nomAlConsell = (persona.nomAlConsell ?? "").trim();
  return {
    carrec: {
      ens: c.ens,
      carrec: c.carrec,
      anualBrut: c.retribucioAnualBruta,
      concepte: c.retribucioAnualBruta === null ? null : "retribució anual bruta",
      dedicacio: c.dedicacio,
      motiuSenseImport: c.motiu,
      sostreAssistencies: c.maximPerAssistencies,
      font: {
        nom: c.font.nom,
        url: c.font.url,
        llicencia: c.font.llicencia ?? null,
        consultat: c.font.consultat ?? null,
      },
    },
    advertiment: sousConsells.advertiment ?? null,
    nota:
      nomAlConsell !== "" && nomAlConsell !== nom.trim()
        ? `A la seu del consell comarcal hi consta com a «${nomAlConsell}».`
        : null,
  };
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
  persones: { nom: string; clau: string; posicio: number | null; capDeLlista: boolean }[];
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
    // Sense número (llistes obertes) al final i per nom: no hi ha cap ordre de
    // llista per respectar, i inventar-ne un posaria algú «primer».
    llista.persones.sort((a, b) =>
      a.posicio === null || b.posicio === null
        ? (a.posicio === null ? 1 : 0) - (b.posicio === null ? 1 : 0) || a.nom.localeCompare(b.nom, "ca")
        : a.posicio - b.posicio,
    );
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
export type LlistaAnada = {
  any: number;
  sigles: string;
  posicio: number | null;
  capDeLlista: boolean;
  elegit: boolean;
};

export type HistorialMunicipi = {
  /** Les municipals de les quals el municipi té candidatures als vots (J2). */
  eleccions: number[];
  /**
   * Les d'`eleccions` en què al registre de llistes hi falta gent: alguna
   * candidatura dels vots sense cap titular, o un nombre d'electes que no és
   * el de regidories. D'aquestes municipals es pot dir el que hi consta, però
   * no el que no hi consta: vegeu `eleccionsConegudes`.
   */
  incompletes: number[];
  /**
   * Les d'`incompletes` en què hi pot faltar algun **electe**: hi falta una
   * candidatura que va treure regidories, o no quadren electes i regidories.
   * Una llista de zero regidories que no ha lligat treu la línia de les
   * llistes, però no la dels mandats: d'aquell any tots els electes hi són.
   */
  electesIncomplets: number[];
  /** Per nom normalitzat, els anys de les municipals que l'han elegit. */
  mandats: Map<string, number[]>;
  /** Per nom normalitzat, els anys de les municipals en què ha anat en una llista com a titular. */
  llistes: Map<string, number[]>;
  /** Per nom normalitzat, cada anada amb el detall: la llista, el número i si en va sortir. */
  candidatures: Map<string, LlistaAnada[]>;
};

/**
 * Tot l'historial de llistes, un sol cop per a les 947 fitxes.
 *
 * La font són les **candidatures proclamades amb `electe`** (J4, que des de
 * l'agost del 2026 ingereix el 2023, el 2019 i el 2015) i no el registre de
 * plens: aquell només porta la composició d'avui, i un mandat antic no hi
 * surt. El que aquesta font no veu —i per això la fitxa parla d'«elegit» i no
 * d'«assegut»— són les substitucions de mandats passats: qui va entrar a mig
 * mandat del 2019 no hi consta elegit el 2019. I per a qui seu avui per
 * substitució, el garbell de `mandatsDe` calla sol: el seu últim any elegit
 * no és el de l'última municipal.
 *
 * `eleccions` surt de les candidatures dels vots (J2) i no de les llistes:
 * una municipal de la qual no ha entrat cap llista també hi ha de ser, perquè
 * el seu silenci no és una absència. I cada municipal es compta **completa**
 * només si cada candidatura dels vots té titulars i si hi ha tants electes
 * com regidories. Fins a l'octubre del 2026 no es mirava: J4 deixava caure
 * sense soroll les llistes amb un codi diferent entre els dos datasets (tot
 * el 2019 local de la demarcació de Barcelona, mig PSC del 2015), i la fitxa
 * de Jaume Collboni, regidor des del 2015, deia «elegit per primera vegada el
 * 2023». Una de cada deu fitxes de persona tenia una frase així de falsa.
 */
async function carregaHistorialMandats(db: Db): Promise<Map<number, HistorialMunicipi>> {
  const perMunicipi = new Map<number, HistorialMunicipi>();
  const de = (municipalityId: number): HistorialMunicipi => {
    let h = perMunicipi.get(municipalityId);
    if (h === undefined) {
      h = {
        eleccions: [], incompletes: [], electesIncomplets: [],
        mandats: new Map(), llistes: new Map(), candidatures: new Map(),
      };
      perMunicipi.set(municipalityId, h);
    }
    return h;
  };
  const afegeix = (map: Map<string, number[]>, clau: string, any: number): void => {
    const anys = map.get(clau) ?? [];
    if (!anys.includes(any)) anys.push(any);
    map.set(clau, anys);
  };

  const files = await db
    .select({
      candidatureId: candidacies.candidatureId,
      municipalityId: candidatures.municipalityId,
      electionId: candidatures.electionId,
      sigles: candidatures.sigles,
      nom: people.fullName,
      posicio: candidacies.listPosition,
      capDeLlista: candidacies.isHead,
      elegit: candidacies.elected,
    })
    .from(candidacies)
    .innerJoin(candidatures, eq(candidatures.id, candidacies.candidatureId))
    .innerJoin(people, eq(people.id, candidacies.personId))
    .where(eq(candidacies.kind, "Titular"));
  const ambTitulars = new Set<number>();
  const electes = new Map<string, number>();
  for (const f of files) {
    const any = anyDeLEleccio(f.electionId);
    if (any === null) continue;
    ambTitulars.add(f.candidatureId);
    const h = de(f.municipalityId);
    const clau = normalizePersonName(f.nom);
    afegeix(h.llistes, clau, any);
    if (f.elegit) {
      afegeix(h.mandats, clau, any);
      electes.set(`${f.municipalityId}|${any}`, (electes.get(`${f.municipalityId}|${any}`) ?? 0) + 1);
    }
    const anades = h.candidatures.get(clau) ?? [];
    // J4 desa un zero quan la font no porta el número (179 municipis del
    // 2023): és «no consta», no el número zero.
    const posicio = f.posicio !== null && f.posicio > 0 ? f.posicio : null;
    anades.push({ any, sigles: f.sigles, posicio, capDeLlista: f.capDeLlista, elegit: f.elegit });
    h.candidatures.set(clau, anades);
  }

  // Les candidatures dels vots, amb les regidories que van treure: és la
  // vara amb què es mesura si les llistes d'una municipal hi són senceres.
  const delsVots = await db
    .select({
      id: candidatures.id,
      municipalityId: candidatures.municipalityId,
      electionId: candidatures.electionId,
      regidories: electionResults.seats,
    })
    .from(candidatures)
    .leftJoin(electionResults, eq(electionResults.candidatureId, candidatures.id));
  const regidories = new Map<string, number | null>();
  const senseTitulars = new Set<string>();
  const senseElectes = new Set<string>();
  for (const c of delsVots) {
    const any = anyDeLEleccio(c.electionId);
    if (any === null) continue;
    const h = de(c.municipalityId);
    if (!h.eleccions.includes(any)) h.eleccions.push(any);
    const clau = `${c.municipalityId}|${any}`;
    const abans: number | null = regidories.has(clau) ? (regidories.get(clau) ?? null) : 0;
    // Una candidatura sense resultat desat deixa el total en «no consta».
    regidories.set(clau, abans === null || c.regidories === null ? null : abans + c.regidories);
    if (!ambTitulars.has(c.id)) {
      senseTitulars.add(clau);
      if (c.regidories !== 0) senseElectes.add(clau);
    }
  }

  for (const [municipalityId, h] of perMunicipi) {
    h.eleccions.sort((a, b) => a - b);
    const noQuadren = (clau: string): boolean => {
      const seients = regidories.get(clau) ?? null;
      return seients === null || (electes.get(clau) ?? 0) !== seients;
    };
    h.electesIncomplets = h.eleccions.filter((any) => {
      const clau = `${municipalityId}|${any}`;
      return senseElectes.has(clau) || noQuadren(clau);
    });
    h.incompletes = h.eleccions.filter((any) => {
      const clau = `${municipalityId}|${any}`;
      return senseTitulars.has(clau) || noQuadren(clau);
    });
    for (const anys of h.mandats.values()) anys.sort((a, b) => a - b);
    for (const anys of h.llistes.values()) anys.sort((a, b) => a - b);
    for (const anades of h.candidatures.values()) anades.sort((a, b) => a.any - b.any);
  }
  return perMunicipi;
}

/**
 * Les municipals de les quals es pot parlar d'aquesta persona en aquest
 * municipi: el tram final d'`eleccions`, de l'última enrere, mentre cada una
 * sigui completa o la persona hi consti.
 *
 * D'una municipal incompleta, el que hi consta és cert —si la seva llista hi
 * és, també ho és si en va sortir— però el que no hi consta no vol dir res:
 * potser hi anava en una de les llistes que falten. Per això el tram s'atura
 * a la primera municipal on no hi consta i on podria haver-hi estat. I es
 * pren el tram de **seguit**, no les municipals soltes: amb un forat al mig,
 * «elegida el 2015 i el 2023» faria creure que el 2019 no.
 *
 * `que` diu de què es vol parlar. Dels mandats (`"electes"`) n'hi ha prou que
 * hi siguin tots els electes; de les llistes on ha anat (`"llistes"`) hi han
 * de ser totes les llistes, també les que no van treure cap regidoria.
 */
export function eleccionsConegudes(
  historial: HistorialMunicipi,
  clau: string,
  que: "llistes" | "electes" = "llistes",
): number[] {
  const incompletes = que === "electes" ? historial.electesIncomplets : historial.incompletes;
  const hiConsta = historial.llistes.get(clau) ?? [];
  const conegudes: number[] = [];
  for (let i = historial.eleccions.length - 1; i >= 0; i -= 1) {
    const any = historial.eleccions[i]!;
    if (incompletes.includes(any) && !hiConsta.includes(any)) break;
    conegudes.unshift(any);
  }
  return conegudes;
}

/** Cert si el mateix nom surt dues vegades a les llistes d'un mateix any: dues persones, o una fila doble. */
function nomRepetit(historial: HistorialMunicipi, clau: string): boolean {
  const anades = historial.candidatures.get(clau) ?? [];
  return new Set(anades.map((a) => a.any)).size !== anades.length;
}

/**
 * Les llistes on ha anat aquesta persona en aquest municipi, per a la línia
 * «Les llistes on ha anat» de la seva fitxa.
 *
 * Les mateixes cauteles que `mandatsDe`: només quan el registre cobreix més
 * d'una municipal d'on es pot parlar d'aquesta persona (`eleccionsConegudes`)
 * —amb una de sola semblaria que abans no s'hi presentava, quan senzillament
 * no ho tenim— i només les anades d'aquestes municipals. I si el mateix nom
 * surt dues vegades el mateix any —dues persones que es diuen igual, o una
 * fila duplicada—, no es diu res: penjar-li a algú l'anada a llistes d'un
 * homònim és pitjor que callar.
 */
export function llistesDe(
  historial: HistorialMunicipi | undefined,
  nom: string,
): ContextRegidor["llistes"] {
  if (!historial) return null;
  const clau = normalizePersonName(nom);
  if (nomRepetit(historial, clau)) return null;
  const eleccions = eleccionsConegudes(historial, clau);
  if (eleccions.length < 2) return null;
  const anades = (historial.candidatures.get(clau) ?? []).filter((a) => eleccions.includes(a.any));
  if (anades.length === 0) return null;
  return [...anades].sort((a, b) => a.any - b.any);
}

/**
 * Quants mandats porta aquesta persona en aquest ple, i des de quan.
 *
 * Només es diu quan el registre té **més d'una** municipal d'on es pot parlar
 * d'aquesta persona (`eleccionsConegudes`): amb una de sola, «primer mandat»
 * seria confondre el que no hem ingerit amb el que no ha passat, i a tots els
 * plens hi ha gent que hi és des de molt abans. `seguits` és cert quan els
 * mandats són les últimes municipals sense cap forat, i `desDe` només afirma
 * un inici quan la municipal anterior a la primera també és al registre: si
 * el registre comença el 2015 i la persona hi és des del 2015, no sabem si hi
 * era el 2011. Un nom repetit el mateix any no diu res, com a `llistesDe`.
 *
 * El tram es mesura amb els electes (`electesIncomplets`) i no amb totes les
 * llistes: a Barcelona, una llista del 2019 de zero regidories que no lliga
 * entre els dos datasets no ha de fer callar els mandats de tot el ple.
 * `llistesSenseEntrar` només diu anades que hi consten, mai que no n'hi hagi.
 */
export function mandatsDe(historial: HistorialMunicipi | undefined, nom: string): ContextRegidor["mandats"] {
  if (!historial) return null;
  const clau = normalizePersonName(nom);
  if (nomRepetit(historial, clau)) return null;
  const eleccions = eleccionsConegudes(historial, clau, "electes");
  if (eleccions.length < 2) return null;
  const anys = (historial.mandats.get(clau) ?? []).filter((a) => eleccions.includes(a));
  if (anys.length === 0) return null;
  // Si l'últim mandat que li consta no és el de l'última municipal, alguna
  // cosa no lliga —un nom escrit diferent en un dels registres— i val més no
  // dir res que comptar malament.
  if (anys[anys.length - 1] !== eleccions[eleccions.length - 1]) return null;
  const primer = anys[0]!;
  const ultimes = eleccions.slice(eleccions.length - anys.length);
  const seguits = ultimes.length === anys.length && ultimes.every((a, i) => a === anys[i]);
  const iniciConegut = eleccions.some((e) => e < primer);
  const llistesSenseEntrar = (historial.llistes.get(clau) ?? []).filter(
    (a) => eleccions.includes(a) && !anys.includes(a),
  );
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
