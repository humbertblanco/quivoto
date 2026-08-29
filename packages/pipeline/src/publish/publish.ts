import { mkdir, writeFile } from "node:fs/promises";
import { desc, isNotNull } from "drizzle-orm";
import { municipalities, type Db } from "@quivoto/db";
import { loadRadiografia, renderRadiografia } from "./radiografia";
import { loadEls947, renderEls947 } from "./els947";
import { INDEXABLE, SITE } from "./config";
import { loadComarques, renderComarca } from "./comarques";
import { loadAmb, renderAmb } from "./amb";
import { loadComparador, renderComparador } from "./comparador";
import { renderDadesIndex, writeDownloads } from "./dades";
import { loadCandidatures, renderCandidatura } from "./candidatura";
import { writeOgImages } from "./og";
import type { PuntMapa } from "./mapa";
import { carregaPreguntes, renderIndexPreguntes, renderPreguntes } from "./preguntes";
import { renderProva } from "./prova";
import { verifica } from "./verificacio";
import { renderPortada } from "./portada";
import { renderMapaCatalunya } from "./mapa-catalunya";
import { encaixa, type Grup } from "./posicions";
import { adrecesRegidors, renderRegidor, type Regidor } from "./regidor";
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
    await mkdir(`${OUT_DIR}../mapa`, { recursive: true });
    await writeFile(`${OUT_DIR}../mapa/index.html`, renderMapaCatalunya(carregats, generatedAt), "utf8");
    run.say(`mapa de Catalunya amb ${carregats.length} municipis`);

    let regidorsEscrits = 0;
    for (const slug of wanted) {
      const data = await loadRadiografia(db, slug, generatedAt);
      if (!data) {
        await run.issue({ kind: "unknown_slug", severity: "mitjana", entity: slug });
        continue;
      }
      const html = renderRadiografia(data, mapa, preguntesPerSlug);
      await mkdir(`${OUT_DIR}${slug}`, { recursive: true });
      await writeFile(`${OUT_DIR}${slug}/index.html`, html, "utf8");
      regidorsEscrits += await escriuRegidors(data, slug, generatedAt);
      if (!all) run.say(`${data.municipality.name} → observatori/m/${slug}/ (${Math.round(html.length / 1024)} kB)`);
      done.push(slug);
      run.rowsOut += 1;
    }

    if (all) run.say(`${done.length} radiografies generades`);
    run.say(`${regidorsEscrits} fitxes de regidor`);


    // Una pàgina per candidatura amb representació: és el subjecte que la
    // brúixola compararà, i qui busca un partit al seu poble hi arriba directe.
    const totes = await loadCandidatures(db);
    for (const candidatura of totes) {
      const dir = `${OUT_DIR}${candidatura.municipality.slug}/${candidatura.slug}`;
      await mkdir(dir, { recursive: true });
      await writeFile(`${dir}/index.html`, renderCandidatura(candidatura, generatedAt), "utf8");
    }
    run.say(`${totes.length} pàgines de candidatura`);

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
      ...(amb ? [`${SITE}/observatori/amb/`] : []),
      ...comarques.map((c) => `${SITE}/observatori/c/${slugify((c as { name?: string; nom?: string }).name ?? (c as { nom?: string }).nom ?? "")}/`),
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

    // La portada de l'Observatori: es genera amb la resta perquè els números que
    // hi surten siguin els que s'acaben de publicar.
    await writeFile(
      `${OUT_DIR}../index.html`,
      renderPortada(
        {
          municipis: done.length,
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
    await writeFile(`${OUT_DIR}../els947.html`, renderEls947(index947, generatedAt, new Set(done)), "utf8");
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
          assistencia: assistenciaDe(dades, carrec.nom),
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
 * A quants plens ha anat una persona, si les actes ho diuen.
 *
 * L'aparellament es fa pel nom normalitzat, i si un nom lliga amb més d'una
 * persona de la llista no es diu res: comptar-li a algú les absències d'un altre
 * és el pitjor error possible en una pàgina amb el seu nom al títol.
 */
function assistenciaDe(
  dades: NonNullable<Awaited<ReturnType<typeof loadRadiografia>>>,
  nom: string,
): { hi: number; de: number } | null {
  const assistencia = dades.mocions?.assistencia ?? null;
  if (!assistencia || assistencia.plensAmbLlista < 5) return null;
  const clau = normalizePersonName(nom);
  const encaixen = assistencia.persones.filter((p) => normalizePersonName(p.nom) === clau);
  if (encaixen.length !== 1) return null;
  return { hi: encaixen[0]!.plens, de: assistencia.plensAmbLlista };
}
