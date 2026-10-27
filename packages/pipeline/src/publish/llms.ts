/**
 * `llms.txt` i `llms-full.txt`: el resum del lloc per als models de llenguatge.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÈ ÉS, I QUÈ NO EN PODEM ESPERAR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `llms.txt` és una proposta (llmstxt.org, 2024) d'un fitxer Markdown a l'arrel
 * del web que diu, en poques línies, què hi ha al lloc i on és. No és cap
 * estàndard i, a l'octubre del 2026, cap dels grans (OpenAI, Anthropic,
 * Google, Perplexity) no ha dit que el llegeixi per decidir què cita. Les
 * mesures que s'han publicat diuen el mateix: la majoria d'aquests fitxers no
 * reben cap visita dels rastrejadors d'IA, que van directament a l'HTML. Google
 * ho diu a la seva guia de funcions d'IA: no cal cap fitxer especial.
 *
 * Es fa igualment perquè costa zero —surt de les mateixes dades que el
 * sitemap, en el mateix pas— i perquè sí que té un lector real: els agents i
 * les eines que un usuari apunta al web («llegeix quivoto.cat i digues-me…»)
 * el busquen, i un resum amb els patrons d'adreça, els principis i com citar
 * els estalvia endevinar-ho. El que fa que ens citin és l'HTML de cada fitxa
 * (respostes curtes amb font i data, dades estructurades): això només n'és
 * l'índex.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ELS DOS FITXERS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · `llms.txt`: qui som, els principis editorials, com citar, les seccions
 *     amb l'adreça, els patrons d'adreça de cada tipus de fitxa, les dades
 *     obertes i cada quan s'actualitza. Curt: es llegeix sencer.
 *   · `llms-full.txt`: el directori. Cada municipi, comarca, ens i partit amb
 *     l'adreça de la seva fitxa i el mínim per reconèixer-lo (la comarca, les
 *     regidories, qui té l'alcaldia). És el que permet a un agent passar de
 *     «l'alcalde de Valls» a la fitxa bona sense cercar.
 *
 * Tots dos van a l'arrel del web (`web/public/`), que és on la proposta diu
 * que s'han de buscar, i porten la data de la publicació a dalt: un model que
 * en cita una línia ha de poder dir de quan és.
 */

import { writeFile } from "node:fs/promises";
import { dataEscrita, nomLlegible } from "../lib/text";
import { SITE } from "./config";
import { adrecaEns, type TipusEns } from "./ens-tipus";

/** El que els dos fitxers necessiten, ja triat: res de files de la base. */
export type DadesLlms = {
  /** ISO, el dia de la publicació. */
  generatedAt: string;
  municipis: readonly {
    slug: string;
    nom: string;
    comarca: string | null;
    regidories: number | null;
    /** Qui té l'alcaldia, tal com la diu la llista dels 947. */
    alcaldia: string | null;
    sigles: string | null;
  }[];
  comarques: readonly { slug: string; nom: string }[];
  partits: readonly { id: string; nom: string; sigles: string }[];
  ens: readonly { tipus: TipusEns; slug: string; nom: string }[];
  /** Quines pàgines opcionals existeixen en aquesta publicació. */
  amb: boolean;
  trajectoria: boolean;
  /** Recomptes del sitemap, per dir la mida de cada secció. */
  candidatures: number;
  persones: number;
};

const OBS = `${SITE}/observatori`;

/** Milers amb punt, com a la resta del web. */
const xifra = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * «27 d'octubre del 2026», sense dependre de l'ICU de la màquina que publica.
 * És `dataEscrita()` de `lib/text.ts` —n'hi havia una còpia aquí— i, si el
 * text no s'entén com a data, es deixa tal com ve.
 */
const data = (iso: string): string => dataEscrita(iso) ?? iso;

/**
 * Un text de la font dins d'un enllaç Markdown: els claudàtors i els salts de
 * línia trencarien la línia i el format.
 */
const net = (t: string): string => t.replace(/[[\]\n\r]/g, " ").replace(/\s+/g, " ").trim();

/** El fitxer curt: què és el lloc, com treballa, com es cita i on és cada cosa. */
export function llmsTxt(d: DadesLlms): string {
  const quan = data(d.generatedAt);
  const diputacions = d.ens.filter((e) => e.tipus === "diputacio").length;
  const consells = d.ens.filter((e) => e.tipus === "consell").length;
  const exemple = d.municipis.find((m) => m.slug === "sabadell") ?? d.municipis[0];
  const linies = [
    "# quivoto: Observatori municipal de Catalunya",
    "",
    `> quivoto reuneix les dades obertes dels ${xifra(d.municipis.length)} ajuntaments de Catalunya: qui governa cada municipi i amb qui, què s'hi ha votat des del 1979, com estan els comptes i qui seu a les diputacions i als consells comarcals. Cada xifra porta la font oficial i l'any. No hi ha cap partit al darrere ni cap model de llenguatge al mig.`,
    "",
    "Catalan-language, non-partisan open-data site about the municipal governments of Catalonia (Spain): mayors, councils, election results since 1979, budgets and debt, provincial councils (diputacions) and county councils (consells comarcals). Every figure cites its official source and year.",
    "",
    `Última publicació: ${quan}. Idioma: català. Qui ho fa: quivoto (Humbert Blanco; titular legal Damos en el Blanco, S.L.). Contacte: hola@quivoto.cat.`,
    "",
    "## Principis editorials",
    "",
    "- Neutral: no rep diners de cap candidatura, no fa campanya per ningú i no dona veredictes. Els colors de partit només marquen dades; no hi ha rànquings de «millors».",
    "- Un buit és un buit: si una font no publica una dada, la fitxa diu «no consta». Mai no és un zero ni una estimació.",
    "- Cada xifra amb la seva font i l'any. Les fonts són oficials i obertes: Generalitat de Catalunya (Dades Obertes), Consorci AOC, Ministeri d'Hisenda, Idescat, INE i Wikidata.",
    "- Càlculs deterministes i repetibles, amb el codi públic. Cap text ni cap xifra no l'escriu un model de llenguatge.",
    "- Una persona només s'enllaça a una altra fitxa si l'aparellament del nom és únic.",
    "- No se sumen imports de pagadors diferents (el sou d'un ajuntament i el d'una diputació van per separat).",
    "",
    "## Com citar",
    "",
    `- Format: «quivoto, Observatori municipal, ${quan}. <adreça de la fitxa>».`,
    "- Per a una dada concreta, enllaceu la fitxa i poseu-hi la data «Generat el…» que surt al peu de la pàgina.",
    "- Les xifres són càlculs de quivoto a partir de fonts oficials: no les presenteu com a xifres oficials, i citeu també la font original (cada fitxa la diu a «D'on surt tot això»).",
    "- Dades derivades: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Les dades originals mantenen la llicència de cada font.",
    "",
    "## Seccions",
    "",
    `- [Observatori](${OBS}/): la portada, amb el cercador de municipis, persones i ens.`,
    `- [Els ${xifra(d.municipis.length)} municipis](${OBS}/els947.html): la llista sencera amb qui hi mana, els comptes i les actes del ple.`,
    ...(exemple ? [`- [Fitxa d'un municipi: ${net(exemple.nom)}](${OBS}/m/${exemple.slug}/): qui governa, el ple, les alcaldies des del 1979, els comptes, el vot i les fonts. N'hi ha una per municipi.`] : []),
    `- [Comarques](${OBS}/c/): qui mana a cadascuna de les ${xifra(d.comarques.length)} comarques.`,
    ...(d.ens.length > 0
      ? [`- [Diputacions i consells comarcals](${OBS}/ens/): les ${xifra(diputacions)} diputacions i els ${xifra(consells)} consells comarcals: qui hi seu, com s'hi arriba sense passar per les urnes i què gasten.`]
      : []),
    `- [Partits](${OBS}/partit/): alcaldies, regidories i població governada de cada força.`,
    `- [Mapa](${OBS}/mapa/): els municipis pintats per qui mana.`,
    `- [Rànquings](${OBS}/ranquings/): cada indicador de dalt a baix, amb l'any i la font.`,
    `- [Comparador](${OBS}/comparador/): de dos a quatre municipis costat a costat.`,
    ...(d.trajectoria ? [`- [Trajectòries](${OBS}/trajectoria/): quant duren les alcaldies des del 1979.`] : []),
    ...(d.amb ? [`- [Àrea Metropolitana de Barcelona](${OBS}/amb/): els seus municipis i què decideix.`] : []),
    `- [Brúixola electoral](${SITE}/): per a les eleccions municipals del 23 de maig del 2027.`,
    "",
    "## Patrons d'adreça",
    "",
    `- Municipi: ${OBS}/m/<municipi>/ (el nom sense article ni accents, amb guions: «prat-de-llobregat», «sant-cugat-del-valles»).`,
    `- Regidor o regidora d'avui: ${OBS}/m/<municipi>/regidor/<persona>/ (${xifra(d.persones)} fitxes de persona, amb les alcaldies històriques).`,
    `- Alcaldia històrica: ${OBS}/m/<municipi>/alcaldia/<persona>/`,
    `- Candidatura de les municipals del 2023: ${OBS}/m/<municipi>/<sigles>/ (${xifra(d.candidatures)} candidatures).`,
    `- Comarca: ${OBS}/c/<comarca>/ · Consell comarcal: ${OBS}/c/<comarca>/consell/`,
    `- Diputació: ${OBS}/diputacio/<barcelona|girona|lleida|tarragona>/`,
    `- Partit: ${OBS}/partit/<partit>/`,
    `- Cerca: ${OBS}/?q=<text>`,
    "",
    "## Dades obertes",
    "",
    `- [Dades de l'Observatori](${OBS}/dades/): totes les descàrregues, llicència CC BY 4.0.`,
    `- [catalunya.csv](${OBS}/dades/catalunya.csv) i [catalunya.json](${OBS}/dades/catalunya.json): una fila per municipi amb els indicadors principals.`,
    `- [ESQUEMA.md](${OBS}/dades/ESQUEMA.md): cada camp, amb les unitats, l'any i la font.`,
    `- [fonts.json](${OBS}/dades/fonts.json): el registre de fonts, amb la llicència i els límits de cadascuna.`,
    `- Un municipi sol: ${OBS}/dades/m/<municipi>.csv i .json`,
    "",
    "## Actualització",
    "",
    `- L'Observatori es regenera sencer quan les fonts publiquen dades noves; cada pàgina diu al peu el dia que es va generar. Aquesta publicació és del ${quan}.`,
    `- Sitemap: ${OBS}/sitemap.xml (el lastmod de cada adreça és el dia que en va canviar el contingut).`,
    "",
    "## Optional",
    "",
    `- [Directori complet](${SITE}/llms-full.txt): cada municipi, comarca, ens i partit amb l'adreça de la seva fitxa.`,
    `- [Premsa](${SITE}/premsa.html): què és quivoto, qui el fa i com treballa.`,
    `- [Avís legal](${SITE}/avis-legal.html)`,
    "",
  ];
  return linies.join("\n");
}

/** Una línia del directori: l'enllaç i el que el distingeix, separat per punts volats. */
function linia(nom: string, url: string, detalls: readonly (string | null)[]): string {
  const resta = detalls.filter((t): t is string => t !== null && t !== "");
  return `- [${net(nom)}](${url})${resta.length > 0 ? `: ${resta.join(" · ")}` : ""}`;
}

/** El directori sencer: totes les fitxes amb el mínim per reconèixer-les. */
export function llmsFullTxt(d: DadesLlms): string {
  const quan = data(d.generatedAt);
  const ordenats = [...d.municipis].sort((a, b) => a.slug.localeCompare(b.slug));
  const municipis = ordenats.map((m) =>
    linia(m.nom, `${OBS}/m/${m.slug}/`, [
      m.comarca ? net(m.comarca) : null,
      m.regidories ? `${xifra(m.regidories)} regidories` : null,
      m.alcaldia ? `alcaldia: ${net(nomLlegible(m.alcaldia))}${m.sigles ? ` (${net(m.sigles)})` : ""}` : null,
    ]),
  );
  const comarques = [...d.comarques].sort((a, b) => a.slug.localeCompare(b.slug)).map((c) => linia(c.nom, `${OBS}/c/${c.slug}/`, []));
  const ens = [...d.ens]
    .sort((a, b) => (a.tipus === b.tipus ? a.slug.localeCompare(b.slug) : a.tipus === "diputacio" ? -1 : 1))
    .map((e) => linia(e.nom, `${OBS}/${adrecaEns(e.tipus, e.slug)}`, []));
  const partits = [...d.partits].sort((a, b) => a.id.localeCompare(b.id)).map((p) => linia(p.nom, `${OBS}/partit/${p.id}/`, [p.sigles !== p.nom ? net(p.sigles) : null]));
  return [
    "# quivoto: directori de l'Observatori municipal",
    "",
    `> Totes les fitxes de l'Observatori municipal de quivoto amb l'adreça de cadascuna. Dades del ${quan}: les alcaldies són les que diu cada fitxa (registre de càrrecs electes de la Generalitat i seus electròniques dels ajuntaments) i les regidories, les del ple sortit de les municipals del 2023. Per a la font i la data de cada dada, aneu a la fitxa. El resum del lloc és a ${SITE}/llms.txt.`,
    "",
    `## Municipis (${xifra(municipis.length)})`,
    "",
    ...municipis,
    "",
    `## Comarques (${xifra(comarques.length)})`,
    "",
    ...comarques,
    ...(ens.length > 0 ? ["", `## Diputacions i consells comarcals (${xifra(ens.length)})`, "", ...ens] : []),
    "",
    `## Partits (${xifra(partits.length)})`,
    "",
    ...partits,
    "",
  ].join("\n");
}

/**
 * Escriu tots dos fitxers a l'arrel del web. `arrel` és `web/public/`, amb la
 * barra final. Torna les mides, perquè el resum de la publicació les digui.
 */
export async function escriuLlms(arrel: string, d: DadesLlms): Promise<{ curt: number; sencer: number }> {
  const curt = llmsTxt(d);
  const sencer = llmsFullTxt(d);
  await writeFile(`${arrel}llms.txt`, curt, "utf8");
  await writeFile(`${arrel}llms-full.txt`, sencer, "utf8");
  return { curt: Buffer.byteLength(curt, "utf8"), sencer: Buffer.byteLength(sencer, "utf8") };
}
