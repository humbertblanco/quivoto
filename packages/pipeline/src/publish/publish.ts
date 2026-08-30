import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { desc, isNotNull } from "drizzle-orm";
import { municipalities, type Db } from "@quivoto/db";
import { loadRadiografia, renderRadiografia } from "./radiografia";
import { carregaMedianes } from "./medianes";
import { escriuCerca, escriuCercaElectes } from "./cerca";
import { carregaSeriesGrup } from "./series-grup";
import { loadEls947, renderEls947 } from "./els947";
import { INDEXABLE, SITE } from "./config";
import { loadComarques, renderComarca } from "./comarques";
import { loadAmb, renderAmb } from "./amb";
import { loadTrajectoriaElectes, renderTrajectoriaElectes } from "./trajectoria-electes";
import { loadComparador, renderComparador } from "./comparador";
import { renderDadesIndex, writeDownloads } from "./dades";
import { loadCandidatures, renderCandidatura } from "./candidatura";
import { loadPartits, renderPartit } from "./partit";
import { writeOgImages } from "./og";
import type { PuntMapa } from "./mapa";
import { carregaPreguntes, renderIndexPreguntes, renderPreguntes } from "./preguntes";
import { renderProva } from "./prova";
import { verifica } from "./verificacio";
import { renderPortada } from "./portada";
import { renderMapaCatalunya } from "./mapa-catalunya";
import { encaixa, type Grup } from "./posicions";
import { adrecesRegidors, renderRegidor, type ContextRegidor, type Regidor } from "./regidor";
import { sameForce } from "@quivoto/shared-schemas/brands";
import { normalizePersonName, slugify } from "../lib/text";
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
    await writeFile(`${OUT_DIR}../mapa/index.html`, renderMapaCatalunya(carregats, generatedAt), "utf8");
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
      regidorsEscrits += await escriuRegidors(data, slug, generatedAt);
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
    run.say(`${partits.length} pàgines de partit`);

    // Pàgines de comarca: «qui mana a la meva comarca» no ho respon ningú.
    const comarques = await loadComarques(db);
    for (const comarca of comarques) {
      const slug = slugify((comarca as { name?: string; nom?: string }).name ?? (comarca as { nom?: string }).nom ?? "");
      if (!slug) continue;
      await mkdir(`${OUT_DIR}../c/${slug}`, { recursive: true });
      await writeFile(`${OUT_DIR}../c/${slug}/index.html`, renderComarca(comarca, generatedAt), "utf8");
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
      ...partits.map((p) => `${SITE}/observatori/partit/${p.id}/`),
      ...(amb ? [`${SITE}/observatori/amb/`] : []),
      ...comarques.map((c) => `${SITE}/observatori/c/${slugify((c as { name?: string; nom?: string }).name ?? (c as { nom?: string }).nom ?? "")}/`),
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
    // hi surten siguin els que s'acaben de publicar.
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
          exemple: preguntes[0]
            ? { slug: preguntes[0].slug, nom: preguntes[0].municipi }
            : null,
          provaDestacada: preguntes[0]
            ? { slug: preguntes[0].slug, nom: preguntes[0].municipi }
            : null,
        },
        generatedAt,
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
): Promise<number> {
  const carrecs = dades.carrecs?.carrecs ?? [];
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
    const regidor: Regidor = {
      nom: carrec.nom,
      carrec: carrec.carrec,
      grup: carrec.grup,
      sigles: delRegistre?.sigles ?? null,
      color: delRegistre?.color ?? null,
      equipGovern: carrec.equipGovern,
      foto: carrec.foto ?? carrec.fotoPetita,
      fitxaOficial: carrec.fitxa,
      posicioLlista: delRegistre?.orderNum ?? null,
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
  const acumulats = dades.carrecsAcumulats;
  if (!acumulats) return { altresCarrecs: [], avisRetribucions: null };
  const clau = normalizePersonName(nom);
  const igual = acumulats.persones.filter((p) => normalizePersonName(p.nom) === clau);
  if (igual.length !== 1) return { altresCarrecs: [], avisRetribucions: null };
  const altres = igual[0]!.altres.map((a) => ({
    ens: a.ens,
    carrec: a.carrec,
    anualBrut: a.retribucio?.anualBrut ?? null,
    concepte: a.retribucio?.concepte ?? null,
    dedicacio: a.retribucio?.dedicacio ?? null,
    motiuSenseImport: a.senseRetribucioPublicada?.motiu ?? null,
    font: a.retribucio?.font ?? a.senseRetribucioPublicada?.font ?? null,
  }));
  return {
    altresCarrecs: altres,
    avisRetribucions: altres.length > 0 ? acumulats.advertiment : null,
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
