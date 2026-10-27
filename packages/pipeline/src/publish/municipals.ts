import { absoluteMajority, councilSeats, dHondt } from "@quivoto/shared-schemas/seats";
import { dataCurta, elDia } from "../lib/text";
import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { SITE } from "./config";
import { RADIOGRAFIA_CSS } from "./estil";
import { GLOSSARI_CSS, renderGlossari, type ClauGlossari } from "./glossari";
import { MASCOTA_CSS, papereta } from "./mascota";
import { peu } from "./peu";
import { ARREL_OBSERVATORI, capSeo, filAriadna, FITXER_OG, imatgeOg } from "./seo";
import { cosPreguntes, GEO_CSS, preguntesLd, quartDiumengeDeMaig, type PreguntaRapida } from "./seo-ld";

/**
 * «Com funcionen les municipals del 2027»: la pàgina per a qui vota per primera
 * vegada, o per primera vegada en aquest poble.
 *
 * L'Observatori explica qui governa cada municipi i amb quins vots, però no
 * deia enlloc com s'arriba a tot això: quin dia es vota, qui hi pot votar, per
 * què un poble té 7 regidories i un altre 21, per què la llista més votada de
 * vegades no té l'alcaldia. Cada fitxa ho suposava sabut. Aquí s'explica una
 * vegada, en pla, i les fitxes, el glossari i la capçalera hi porten.
 *
 * ## D'on surt cada data
 *
 * **Cap data no s'escriu a mà: totes surten de la llei.** La LOREG (Llei
 * orgànica 5/1985, BOE-A-1985-11672) fixa les municipals el quart diumenge de
 * maig (art. 42.3) i compta tots els terminis en dies des de la convocatòria.
 * El decret s'expedeix el dia 55è abans de votar i es publica al BOE l'endemà,
 * que és el dia que compta com a convocatòria. Comprovat amb el 2023: Reial
 * decret 207/2023, de 3 d'abril (BOE del 4 d'abril, BOE-A-2023-8458), per
 * votar el 28 de maig; candidatures del 19 al 24 d'abril (dies 15 a 20, art.
 * 45), campanya del 12 al 26 de maig (dia 38 i quinze dies, art. 51) i plens
 * constituïts el 17 de juny (dia 20è després de votar, art. 195). Les mateixes
 * regles aplicades al 23 de maig del 2027 donen la taula de `calendariMunicipals()`.
 *
 * Fins que el decret no surti al BOE, cada data porta «data prevista segons la
 * LOREG»: és el que diu la llei, però el decret és el que la fa oficial. Quan
 * surti, `publish.ts` hi passa `decret` i l'avís canvia. L'única data que no
 * surt de la LOREG és la del cens dels ciutadans de la Unió Europea, que la
 * publica l'INE (nota del 30 de setembre del 2026: fins al 30 de desembre).
 *
 * ## El que no diem
 *
 * Neutralitat de sempre: ni a qui votar, ni si la llei d'Hondt és justa, ni si
 * una moció de censura està bé. Es diu com funciona, amb l'article al costat.
 * L'exemple de la llei d'Hondt és de quatre candidatures inventades («A», «B»,
 * «C», «D») i el calcula `dHondt()` de `shared-schemas`, que és la mateixa
 * funció que reprodueix els plens de debò: si mai s'equivoqués, l'exemple de
 * la pàgina també, i la prova ho diria.
 *
 * Les classes porten el prefix `mun-`: una classe nua xoca amb el peu.
 */

// ─────────────────────────────────────────────────────────────────────────────
// El calendari
// ─────────────────────────────────────────────────────────────────────────────

/** El dia de les eleccions: el quart diumenge de maig del 2027 (LOREG, art. 42.3). */
export const DIA_MUNICIPALS_2027 = quartDiumengeDeMaig(2027);

/** La LOREG consolidada, al BOE: és la font de cada article que cita la pàgina. */
export const URL_LOREG = "https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672";

/** La pàgina de l'INE per al cens dels residents estrangers a les municipals del 2027. */
export const URL_INE_CERE = "https://www.ine.es/dyngs/CEL/index.htm?cid=383";

/** El termini que l'INE va publicar per als ciutadans de la UE (nota del 30-9-2026). */
export const TERMINI_UE_2027 = "2026-12-30";

/** Una data ISO més (o menys) uns dies, sense que el fus horari hi posi la mà. */
export function sumaDies(iso: string, dies: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, d! + dies)).toISOString().slice(0, 10);
}

const DIES_SETMANA = ["diumenge", "dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte"];

/** «diumenge» per a «2027-05-23». */
export function diaSetmana(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return DIES_SETMANA[new Date(Date.UTC(a!, m! - 1, d!)).getUTCDay()]!;
}

/** Una fita del calendari: un dia, o un tram de dies, amb l'article que el fixa. */
export type FitaCalendari = {
  id: string;
  /** Primer dia, ISO. */
  des: string;
  /** Últim dia, ISO; igual que `des` si és un sol dia. */
  fins: string;
  titol: string;
  /** Què passa, en una o dues frases. */
  text: string;
  /** D'on surt: «LOREG, art. 45» o «INE». */
  font: string;
  /** Si surt de la LOREG (prevista fins al decret) o d'un organisme que ja l'ha publicada. */
  origen: "loreg" | "publicada";
};

/**
 * Totes les fites, a partir del dia de votar. `convocatoria` és el dia que el
 * decret surt al BOE (54 dies abans), que és el dia zero de tots els terminis.
 */
export function calendariMunicipals(dia: string = DIA_MUNICIPALS_2027): FitaCalendari[] {
  const conv = sumaDies(dia, -54);
  const d = (n: number): string => sumaDies(conv, n);
  const f = (id: string, des: string, fins: string, titol: string, text: string, font: string, origen: FitaCalendari["origen"] = "loreg"): FitaCalendari =>
    ({ id, des, fins, titol, text, font, origen });
  return [
    f("cens-ue", TERMINI_UE_2027, TERMINI_UE_2027, "Últim dia per als ciutadans de la UE",
      "Qui és d'un altre país de la Unió Europea i vol votar aquí ha d'haver dit a l'INE que vol votar a Espanya. Si ja ho havia fet en unes altres municipals, no cal repetir-ho.",
      "INE, Oficina del Cens Electoral", "publicada"),
    f("convocatoria", conv, conv, "Les eleccions es convoquen",
      `El decret es signa el dia abans (${dataCurta(sumaDies(conv, -1))}) i surt al BOE: des d'aquest dia comencen a comptar tots els terminis.`,
      "LOREG, art. 42.3"),
    f("cens", d(6), d(13), "Consulta del cens",
      "Durant vuit dies l'ajuntament ensenya les llistes del cens electoral. És el moment de comprovar que hi ets i, si no, de reclamar-ho.",
      "LOREG, art. 39"),
    f("candidatures", d(15), d(20), "Es presenten les candidatures",
      "Els partits, les coalicions i les agrupacions d'electors entreguen les seves llistes a la Junta Electoral de Zona.",
      "LOREG, art. 45"),
    f("proclamacio", d(27), d(27), "Es proclamen les candidatures",
      "La Junta Electoral diu quines llistes s'han acceptat; l'endemà es publiquen. A partir d'aquí ja se sap qui es presenta a cada poble.",
      "LOREG, art. 47"),
    f("campanya", d(38), sumaDies(dia, -2), "Campanya electoral",
      "Quinze dies de mítings, cartells i propaganda. S'acaba a mitjanit de la nit del divendres al dissabte.",
      "LOREG, art. 51"),
    f("correu-demana", conv, sumaDies(dia, -10), "Es pot demanar el vot per correu",
      "Des del dia de la convocatòria fins al desè dia abans de votar, a qualsevol oficina de Correos.",
      "LOREG, art. 72"),
    f("correu-envia", sumaDies(dia, -4), sumaDies(dia, -4), "Últim dia per enviar el vot per correu",
      "El sobre s'ha de lliurar a Correos, certificat, abans del tercer dia previ a les eleccions.",
      "LOREG, art. 73"),
    f("reflexio", sumaDies(dia, -1), sumaDies(dia, -1), "Jornada de reflexió",
      "No hi pot haver propaganda ni actes de campanya.",
      "LOREG, art. 53"),
    f("eleccions", dia, dia, "Eleccions municipals",
      "Es vota de 9 a 20 h al col·legi electoral que et toca. Aquella mateixa nit ja se sap quantes regidories té cada llista.",
      "LOREG, art. 42.3 i 84"),
    f("ple", sumaDies(dia, 20), sumaDies(dia, 20), "Es constitueixen els ajuntaments i es tria l'alcaldia",
      "El ple nou pren possessió i, en la mateixa sessió, elegeix l'alcalde o l'alcaldessa. Si hi ha un recurs contra els resultats, es fa el dia 40è.",
      "LOREG, art. 195 i 196"),
  ].sort((a, b) => a.des.localeCompare(b.des) || a.fins.localeCompare(b.fins));
}

// ─────────────────────────────────────────────────────────────────────────────
// Les regidories i la llei d'Hondt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Els trams de l'art. 179, escrits a partir de `councilSeats()` i no copiats:
 * si mai la funció canviés, la taula de la pàgina canviaria amb ella i el
 * que es publica seria sempre el que el codi fa servir per comptar.
 */
const SOSTRES_TRAMS = [100, 250, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000] as const;

export type TramRegidories = { des: number; fins: number | null; regidories: number };

export function tramsRegidories(): TramRegidories[] {
  let des = 0;
  return SOSTRES_TRAMS.map((fins) => {
    const tram = { des, fins, regidories: councilSeats(fins) };
    des = fins + 1;
    return tram;
  });
}

/** Tres exemples per sobre dels 100.000, calculats amb la mateixa regla. */
export const EXEMPLES_GRANS = [150_000, 250_000, 1_700_000].map((habitants) => ({ habitants, regidories: councilSeats(habitants) }));

/** Les candidatures de l'exemple: inventades, sense colors ni sigles de cap partit. */
export const EXEMPLE_DHONDT = {
  regidories: 7,
  candidatures: [
    { id: "A", votes: 340 },
    { id: "B", votes: 260 },
    { id: "C", votes: 150 },
    { id: "D", votes: 30 },
  ],
  blancs: 20,
} as const;

export type CelaQuocient = { divisor: number; quocient: number; guanya: boolean };
export type FilaDHondt = { id: string; vots: number; exclosa: boolean; regidories: number; quocients: CelaQuocient[] };

/**
 * L'exemple resolt: els quocients de cada candidatura (vots ÷ 1, 2, 3…), quins
 * s'enduen una regidoria, i qui queda fora per la barrera. Les regidories les
 * dona `dHondt()`; les cel·les guanyadores són els quocients més grans de les
 * candidatures que passen la barrera, que és el que la taula ensenya.
 */
export function resolExempleDHondt(e = EXEMPLE_DHONDT): { valids: number; barrera: number; files: FilaDHondt[] } {
  const valids = e.candidatures.reduce((a, c) => a + c.votes, 0) + e.blancs;
  const resultat = dHondt(e.candidatures, e.regidories, { validVotes: valids });
  const files: FilaDHondt[] = e.candidatures.map((c) => ({
    id: c.id,
    vots: c.votes,
    exclosa: resultat.excluded.includes(c.id),
    regidories: resultat.seats[c.id] ?? 0,
    quocients: Array.from({ length: Math.min(4, e.regidories) }, (_, i) => ({
      divisor: i + 1,
      quocient: c.votes / (i + 1),
      // Una candidatura amb n regidories guanya els seus n primers quocients.
      guanya: i < (resultat.seats[c.id] ?? 0),
    })),
  }));
  return { valids, barrera: valids * 0.05, files };
}

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Milers amb punt, com la resta de l'Observatori. */
const enter = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** «113,3» o «170»: el quocient amb un decimal només si en té. */
const quocient = (q: number): string => (Number.isInteger(q) ? enter(q) : q.toFixed(1).replace(".", ","));

/** La taula dels trams, amb una fila per tram i l'última dient la regla de les ciutats. */
function taulaTrams(): string {
  const files = tramsRegidories()
    .map((t) => `<tr><th scope="row">${t.des === 0 ? "Fins a" : `De ${enter(t.des)} a`} ${enter(t.fins!)}</th><td>${t.regidories}</td></tr>`)
    .join("");
  const grans = EXEMPLES_GRANS.map((g) => `${enter(g.habitants)} habitants, ${g.regidories}`).join("; ");
  return `<div class="taula-envolta"><table class="mun-trams">
  <thead><tr><th scope="col">Habitants</th><th scope="col">Regidories</th></tr></thead>
  <tbody>${files}
  <tr><th scope="row">Més de 100.000</th><td class="mun-regla">25, i una més per cada 100.000 habitants o fracció; si surt parell, una més</td></tr>
  </tbody></table></div>
<p class="nota">Per exemple: ${grans}. El nombre és sempre senar perquè al ple no hi pugui haver empats de meitat i meitat.</p>`;
}

/** L'exemple de la llei d'Hondt en una taula: files les candidatures, columnes els divisors. */
function taulaDHondt(): string {
  const { valids, barrera, files } = resolExempleDHondt();
  const columnes = files[0]!.quocients.map((q) => `<th scope="col">÷ ${q.divisor}</th>`).join("");
  const cos = files
    .map((f) => {
      const celes = f.exclosa
        ? `<td colspan="${f.quocients.length}" class="mun-fora">No arriba al 5 %: queda fora</td>`
        : f.quocients.map((q) => `<td${q.guanya ? ' class="mun-guanya"' : ""}>${quocient(q.quocient)}</td>`).join("");
      return `<tr><th scope="row"><span class="nomes-lectors">Candidatura </span>${escape(f.id)}</th><td class="mun-vots">${enter(f.vots)}</td>${celes}<td class="mun-total">${f.regidories}</td></tr>`;
    })
    .join("");
  return `<p>Un poble de 600 habitants tria <b>${EXEMPLE_DHONDT.regidories} regidories</b>. Hi ha ${enter(valids)} vots vàlids:
  els de quatre candidatures i ${enter(EXEMPLE_DHONDT.blancs)} en blanc. La barrera és el 5 % de ${enter(valids)}, és a dir,
  <b>${enter(barrera)} vots</b>.</p>
<div class="taula-envolta"><table class="mun-dhondt">
  <caption class="nomes-lectors">Repartiment de ${EXEMPLE_DHONDT.regidories} regidories amb la llei d'Hondt: vots de cada candidatura dividits per 1, 2, 3 i 4</caption>
  <thead><tr><th scope="col">Candidatura</th><th scope="col">Vots</th>${columnes}<th scope="col">Regidories</th></tr></thead>
  <tbody>${cos}</tbody>
</table></div>
<p class="nota">${notaDHondt(files, valids)}</p>`;
}

/**
 * La lectura de l'exemple, escrita a partir del resultat: qui queda fora per
 * la barrera, i com acaben les dues primeres. No hi ha cap xifra escrita a mà,
 * perquè si algú canvia els vots de l'exemple la frase no pot quedar enrere.
 */
export function notaDHondt(files: readonly FilaDHondt[], valids: number): string {
  const pct = (v: number): string => `${Math.round((v / valids) * 100)} %`;
  const n = EXEMPLE_DHONDT.regidories;
  const frases = [`Les ${n} cel·les marcades són els ${n} quocients més grans, i cada una és una regidoria.`];
  const dins = files.filter((f) => !f.exclosa);
  const [primera, segona] = dins;
  // Qui s'ha endut l'última regidoria: el quocient guanyador més petit.
  const guanyadores = dins.flatMap((f) => f.quocients.filter((q) => q.guanya).map((q) => ({ id: f.id, q: q.quocient })));
  const ultima = guanyadores.sort((a, b) => a.q - b.q)[0];
  if (primera && segona && primera.regidories === segona.regidories && ultima?.id === segona.id) {
    const perdut = primera.quocients[primera.regidories];
    frases.push(
      `La ${primera.id} (${pct(primera.vots)} dels vots) i la ${segona.id} (${pct(segona.vots)}) treuen ${primera.regidories} regidories cadascuna: ` +
        `l'última se l'endú la ${segona.id} perquè el seu quocient (${quocient(ultima.q)}) passa per poc el següent de la ${primera.id}` +
        `${perdut ? ` (${quocient(perdut.quocient)})` : ""}.`,
    );
  }
  for (const f of files.filter((f) => f.exclosa)) {
    frases.push(`La ${f.id}, amb el ${pct(f.vots)}, no arriba al 5 % i no entra al repartiment.`);
  }
  const majoria = absoluteMajority(n);
  if (dins.every((f) => f.regidories < majoria)) {
    frases.push(`Cap no arriba a la majoria absoluta, que són ${majoria} de ${n}: l'alcaldia dependrà de com votin els regidors.`);
  }
  return frases.join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Les preguntes
// ─────────────────────────────────────────────────────────────────────────────

const FONT_LOREG = (articles: string) => ({ nom: `LOREG, ${articles}`, url: URL_LOREG });

/**
 * Els països amb conveni de reciprocitat per votar a les municipals: la llista
 * que l'INE va donar per al 2023 (nota «elecmun23_1»). La de 2027 la comunicarà
 * el Govern a l'Oficina del Cens (LOREG, art. 176.2); si canvia, es canvia aquí.
 */
export const PAISOS_CONVENI = [
  "Bolívia", "Cap Verd", "Colòmbia", "Corea del Sud", "l'Equador", "Islàndia", "Noruega",
  "Nova Zelanda", "el Paraguai", "el Perú", "el Regne Unit", "Trinitat i Tobago", "Xile",
] as const;

/** «a, b i c». */
const llista = (items: readonly string[]): string => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} i ${items.at(-1)}`);

/**
 * Les sis preguntes, a la vista i com a `FAQPage`. Les dates surten del mateix
 * calendari que la taula, i porten «prevista» fins que hi ha decret.
 */
export function preguntesMunicipals(calendari: readonly FitaCalendari[], ambDecret: boolean): PreguntaRapida[] {
  const fita = (id: string): FitaCalendari => calendari.find((f) => f.id === id)!;
  const previstes = ambDecret ? null : "dates previstes segons la LOREG";
  const dia = fita("eleccions").des;
  return [
    {
      pregunta: "Quan són les properes eleccions municipals a Catalunya?",
      resposta: `El ${diaSetmana(dia)} ${dataCurta(dia)}. La llei les fixa el quart diumenge de maig, cada quatre anys, i es vota alhora als 947 municipis.`,
      font: FONT_LOREG("article 42.3"),
      quan: null,
    },
    {
      pregunta: "Puc votar a les municipals si no tinc la nacionalitat espanyola?",
      resposta:
        `Sí, si estàs empadronat al municipi i ets d'un altre país de la Unió Europea o d'un país amb conveni (${llista(PAISOS_CONVENI)}), ` +
        `i has demanat d'entrar al cens electoral. Per als ciutadans de la UE el termini acaba el ${dataCurta(TERMINI_UE_2027)}; ` +
        "els dels països amb conveni també han de portar uns anys de residència legal (cinc, o tres per al Regne Unit i Noruega).",
      font: { nom: "INE, Oficina del Cens Electoral", url: URL_INE_CERE },
      quan: null,
    },
    {
      pregunta: "Com es vota per correu a les municipals del 2027?",
      resposta:
        `Es demana en persona a qualsevol oficina de Correos, amb el DNI, fins al ${dataCurta(fita("correu-demana").fins)}. ` +
        `Les paperetes arriben a casa, i el vot s'ha d'enviar per correu certificat fins al ${dataCurta(fita("correu-envia").des)}.`,
      font: FONT_LOREG("articles 72 i 73"),
      quan: previstes,
    },
    {
      pregunta: "Quantes regidories té el meu ajuntament?",
      resposta:
        "Depèn dels habitants: 3 fins a 100, 5 fins a 250, 7 fins a 1.000 i així fins a 25 entre 50.001 i 100.000; per sobre, " +
        "una més per cada 100.000 habitants o fracció, i sempre un nombre senar. Ho diu la llei, no l'ajuntament.",
      font: FONT_LOREG("article 179"),
      quan: null,
    },
    {
      pregunta: "Qui tria l'alcalde o l'alcaldessa?",
      resposta:
        `Els regidors, el dia que es constitueix el ple nou (el ${dataCurta(fita("ple").des)} si no hi ha recursos). ` +
        "Si un cap de llista té els vots de la majoria absoluta, és elegit; si no, ho és el cap de la llista més votada.",
      font: FONT_LOREG("articles 195 i 196"),
      quan: previstes,
    },
    {
      pregunta: "Puc votar a les municipals si visc a l'estranger?",
      resposta:
        "Si hi vius de manera permanent i estàs inscrit al cens de residents a l'estranger (CERA), no: per a les municipals cal ser al cens de residents a Espanya. " +
        "Si només hi ets temporalment i continues empadronat aquí, pots votar per correu.",
      font: FONT_LOREG("articles 2.3 i 74"),
      quan: null,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// La pàgina
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El full propi. Tot penja de classes `mun-`. Cap targeta amb ombra: el
 * calendari és una llista amb una ratlla de tinta a l'esquerra, com un
 * recorregut, i el dia de votar és l'única fita pintada (de préssec, el color
 * de la doblegada de la papereta). Les cel·les guanyadores de la llei d'Hondt
 * van de menta amb la tinta escrita a mà, perquè en fosc la menta continua
 * sent clara i el text ha de continuar sent fosc.
 *
 * L'entrada és `.mun-portada` i no la `.portada` de la casa: aquella reserva
 * una segona columna per al mapa de situació de les fitxes, i aquí, sense
 * mapa, el títol quedava en cinc línies dins de mitja pantalla.
 */
export const MUNICIPALS_CSS = `
.mun-portada{padding:var(--e3) 0 var(--e4)}
.mun-portada .entrada{max-width:36em}
.mun-cerca{display:flex;flex-wrap:wrap;align-items:center;gap:var(--e1) var(--e2);margin:var(--e3) 0 0}
/* El botó del cercador neix amb «hidden» i el guió l'ensenya; la regla de base
   de «.obre-cerca» el tornava a mostrar sense guió. I aquí el text és la crida:
   no s'amaga al mòbil com el de la capçalera. */
.mun-cerca .obre-cerca,.mun-salts .obre-cerca{margin:0;min-height:44px;font-size:.9rem;background:var(--presec);
  color:#1E1B2E;box-shadow:var(--ombra)}
.mun-cerca .obre-cerca:hover,.mun-salts .obre-cerca:hover{background:var(--ink);color:var(--paper)}
.mun-cerca .obre-cerca[hidden],.mun-salts .obre-cerca[hidden]{display:none}
.mun-cerca .obre-cerca span,.mun-salts .obre-cerca span{position:static;width:auto;height:auto;overflow:visible;clip:auto}
.mun-salts .obre-cerca{margin:0 0 var(--e1)}
.mun-cerca a{font-weight:700}
.mun-avis{border-left:4px solid var(--coral);padding:var(--e1) 0 var(--e1) var(--e2);margin:0 0 var(--e3);max-width:44em}
.mun-cal{list-style:none;margin:0;padding:0;border-left:2.5px solid var(--ink);max-width:46em}
.mun-cal li{position:relative;padding:0 0 var(--e3) var(--e3)}
.mun-cal li::before{content:"";position:absolute;left:-8px;top:.45em;width:13px;height:13px;border-radius:50%;
  background:var(--paper);border:2.5px solid var(--ink)}
.mun-cal .mun-data{display:block;font-family:var(--display);font-weight:800;font-size:1.02rem;line-height:1.3}
.mun-cal h3{font-family:var(--text);font-weight:800;font-size:1rem;margin:2px 0 4px}
.mun-cal p{margin:0;color:var(--ink-suau);font-size:.95rem}
.mun-cal .mun-font{font-size:.8rem;margin-top:4px}
.mun-cal .mun-dia{background:var(--presec);color:#1E1B2E;border-radius:var(--r-m);padding:var(--e2) var(--e2) var(--e2) var(--e3);margin:0 0 var(--e3)}
.mun-cal .mun-dia::before{background:var(--coral)}
.mun-cal .mun-dia p{color:#524D63}
.mun-cal .mun-passada .mun-data,.mun-cal .mun-passada h3{color:var(--ink-suau)}
.mun-cal .mun-passada::before{background:var(--ink-suau);border-color:var(--ink-suau)}
.mun-fet{font-family:var(--text);font-size:.78rem;font-weight:700;color:var(--ink-suau);margin-left:6px}
.mun-casos{list-style:none;margin:0 0 var(--e3);padding:0;display:grid;gap:var(--e2);max-width:46em}
.mun-casos li{padding-left:var(--e2);border-left:2.5px solid var(--vora)}
.mun-casos b{display:block}
.bloc h3.mun-sub{font-family:var(--display);font-weight:800;font-size:1.2rem;margin:var(--e4) 0 var(--e1)}
.mun-trams,.mun-dhondt{border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:.95rem;margin:0 0 var(--e1)}
.mun-trams th,.mun-trams td,.mun-dhondt th,.mun-dhondt td{padding:8px 12px;border-bottom:2px solid var(--vora);text-align:right}
.mun-trams th[scope="row"],.mun-dhondt th[scope="row"]{text-align:left;font-weight:700}
.mun-trams thead th,.mun-dhondt thead th{font-size:.8rem;font-weight:800;color:var(--ink-suau);border-bottom:2.5px solid var(--ink)}
.mun-trams thead th:first-child,.mun-dhondt thead th:first-child{text-align:left}
.mun-trams .mun-regla{text-align:left;white-space:normal;max-width:22em}
.mun-dhondt .mun-guanya{background:var(--menta);color:#1E1B2E;font-weight:800}
.mun-dhondt .mun-fora{text-align:left;color:var(--ink-suau);font-size:.86rem}
.mun-dhondt .mun-total{font-family:var(--display);font-weight:900;font-size:1.1rem}
.mun-dhondt .mun-vots{color:var(--ink-suau)}
.mun-dhondt th[scope="row"]{font-family:var(--display);font-weight:900;font-size:1.1rem}
/* Set columnes en 340 px: es fan estretes abans de fer lliscar la taula. */
@media (max-width:520px){
  .mun-dhondt{font-size:.86rem}
  .mun-dhondt th,.mun-dhondt td{padding:8px 4px}
  .mun-dhondt thead th{font-size:.72rem}
}
.mun-salts{list-style:none;margin:0;padding:0;display:grid;gap:var(--e2);max-width:46em}
.mun-salts a{font-weight:800}
`;

/** «diumenge 23 de maig del 2027», o «del 15 al 20 d'abril» si és un tram. */
export function dataFita(f: Pick<FitaCalendari, "des" | "fins">): string {
  if (f.des === f.fins) return `${diaSetmana(f.des)} ${dataCurta(f.des)}`;
  const [a1, m1] = f.des.split("-");
  const [a2, m2] = f.fins.split("-");
  // Mateix mes: «del 5 al 12 d'abril del 2027»; si no, les dues dates senceres.
  const d1 = Number(f.des.slice(8));
  if (a1 === a2 && m1 === m2) return `${d1 === 1 || d1 === 11 ? "de l'" : "del "}${d1} al ${dataCurta(f.fins)}`;
  const des = dataCurta(f.des);
  return `${/^(1|11) /.test(des) ? "de l'" : "del "}${des} al ${dataCurta(f.fins)}`;
}

/** El calendari com a llista: el dia de votar, pintat; el que ja ha passat, en gris. */
function llistaCalendari(calendari: readonly FitaCalendari[], avui: string): string {
  const items = calendari.map((f) => {
    const passada = f.fins < avui;
    const classe = f.id === "eleccions" ? "mun-dia" : passada ? "mun-passada" : "";
    return `<li id="fita-${escape(f.id)}"${classe ? ` class="${classe}"` : ""}>
    <time class="mun-data" datetime="${escape(f.des)}">${escape(dataFita(f))}${passada ? '<span class="mun-fet">ja ha passat</span>' : ""}</time>
    <h3>${escape(f.titol)}</h3>
    <p>${escape(f.text)}</p>
    <p class="mun-font">${escape(f.font)}</p>
  </li>`;
  });
  return `<ol class="mun-cal">
  ${items.join("\n  ")}
</ol>`;
}

/** Un municipi que el 2023 va votar en consell obert, per enllaçar-hi. */
export type MunicipiConsellObert = { nom: string; slug: string };

export type OpcionsMunicipals = {
  /**
   * El decret de convocatòria, quan ja és al BOE. Sense, cada data porta
   * «prevista segons la LOREG»; amb, l'avís diu que el decret les ha fixat.
   */
  decret?: { nom: string; url: string } | null;
  /**
   * Els municipis que a les darreres municipals van votar en consell obert
   * (J37, `regidors === 1`). Sense llista, la pàgina ho diu sense noms.
   */
  consellObert?: readonly MunicipiConsellObert[];
};

/** Qui pot votar, el vot per correu i qui viu fora. */
function seccioQuiVota(cal: readonly FitaCalendari[], base: string): string {
  const fita = (id: string): FitaCalendari => cal.find((f) => f.id === id)!;
  const conv = fita("convocatoria").des;
  // LOREG 39.1: el cens tancat el primer dia del segon mes abans de la convocatòria.
  const [a, m] = conv.split("-").map(Number);
  const tancament = new Date(Date.UTC(a!, m! - 3, 1)).toISOString().slice(0, 10);
  return `<section class="bloc" id="qui-vota">
  <h2>Qui pot votar</h2>
  <p>Per votar cal ser al <b>cens electoral</b> del municipi, i el cens surt del padró: si hi estàs
  empadronat i el ${escape(dataCurta(fita("eleccions").des))} tens 18 anys o més, hi ets. No cal fer res més si:</p>
  <ul class="mun-casos">
    <li><b>Tens la nacionalitat espanyola.</b> Entres al cens automàticament quan t'empadrones.</li>
    <li><b>Ets d'un altre país de la Unió Europea.</b> Has de dir a l'INE que vols votar a Espanya, per
    internet amb Cl@ve o a l'ajuntament. El termini per al 2027 acaba ${escape(`el ${dataCurta(TERMINI_UE_2027)}`)}.
    Si ja ho vas fer per a unes altres municipals, continues inscrit.</li>
    <li><b>Ets d'un país amb conveni amb Espanya:</b> ${escape(llista(PAISOS_CONVENI))}. Cal
    residència legal de cinc anys (tres per al Regne Unit i Noruega) i demanar l'alta al cens a l'ajuntament.
    El 2023 el termini va ser de l'1 de desembre al 15 de gener; el del 2027 el publica l'<a href="${escape(URL_INE_CERE)}" rel="noopener">INE</a>.</li>
  </ul>
  <p>El cens que compta és el tancat ${escape(elDia(tancament))}
  (data prevista segons la LOREG): si canvies de municipi després, és probable que votis on eres abans.
  ${escape(dataFita(fita("cens")).replace(/^./, (c) => c.toUpperCase()))} pots consultar-lo a l'ajuntament o a la web de l'INE, i reclamar si hi ha un error.</p>

  <h3 class="mun-sub" id="correu">Si aquell dia no hi seràs: el vot per correu</h3>
  <ol class="mun-casos">
    <li><b>Demana'l fins al ${escape(dataCurta(fita("correu-demana").fins))}.</b> En persona, amb el DNI, a qualsevol
    oficina de Correos. Si una malaltia t'ho impedeix, pot anar-hi una altra persona amb un certificat mèdic oficial i una autorització davant de notari.</li>
    <li><b>Rebràs les paperetes a casa.</b> L'Oficina del Cens Electoral t'envia per correu certificat el certificat, les paperetes i els sobres a l'adreça que hagis donat, i les has de recollir tu, amb el DNI.</li>
    <li><b>Envia el vot fins al ${escape(dataCurta(fita("correu-envia").des))}.</b> Per correu certificat, des de qualsevol
    oficina de Correos; no cal segell. Un cop demanat el vot per correu, ja no pots votar a la mesa.</li>
  </ol>

  <h3 class="mun-sub" id="estranger">Si vius a l'estranger</h3>
  <p>Si hi vius de manera permanent i estàs inscrit al cens de residents a l'estranger (el CERA), <b>no pots votar a
  les municipals</b>: des del 2011 la llei demana ser al cens de residents a Espanya (LOREG, art. 2.3). Pots votar a
  les generals, a les europees i al Parlament. Si només hi ets uns mesos i continues empadronat aquí, sí que pots: per correu.</p>
  <p class="nota">Vols saber quanta gent hi ha al cens del teu municipi i quanta va votar el 2023? És a la fitxa de cada
  municipi, amb la participació de totes les municipals des del 1979. <a href="${escape(base)}els947.html">Els 947 municipis</a>.</p>
</section>`;
}

/** Quantes regidories, la llista tancada, la llei d'Hondt i la llista oberta. */
function seccioEscons(base: string, consellObert: readonly MunicipiConsellObert[] | undefined): string {
  const obert =
    consellObert && consellObert.length > 0
      ? `El 2023 n'hi va haver ${consellObert.length === 1 ? "un" : consellObert.length}: ${llista(
          consellObert.map((m) => `<a href="${escape(`${base}m/${m.slug}/`)}">${escape(m.nom)}</a>`),
        )}.`
      : "Són molt pocs, i tots molt petits.";
  return `<section class="bloc" id="escons">
  <h2>Com es reparteixen les regidories</h2>
  <p>Cada municipi tria el seu ple, i el nombre de regidories no el decideix l'ajuntament: el fixa la llei
  segons els habitants del padró.</p>
  ${taulaTrams()}

  <h3 class="mun-sub" id="llista-tancada">Als municipis de més de 250 habitants, llistes tancades</h3>
  <p>Votes una <b>llista sencera</b>: una candidatura amb els noms en un ordre que no es pot tocar. Si ratlles,
  afegeixes o canvies l'ordre dels noms, el vot és nul. Un sobre buit és un vot en blanc, i compta com a vot vàlid.</p>
  <p>Les regidories es reparteixen amb la <b>llei d'Hondt</b>, en dos passos:</p>
  <ol class="mun-casos">
    <li><b>La barrera del 5 %.</b> Les llistes que no arriben al 5 % dels vots vàlids, comptant-hi els vots en blanc, queden fora.</li>
    <li><b>Les divisions.</b> Els vots de cada llista que queda es divideixen per 1, 2, 3… i les regidories van, una a una, als quocients més grans.</li>
  </ol>

  <h3 class="mun-sub" id="dhondt">Un exemple, pas a pas</h3>
  ${taulaDHondt()}

  <h3 class="mun-sub" id="llista-oberta">Als municipis de fins a 250 habitants, llistes obertes</h3>
  <p>Aquí no es vota una llista, es voten <b>persones</b>. Cada candidatura presenta fins a 3 noms (fins a 100
  habitants) o fins a 5 (de 101 a 250), i a la papereta pots marcar fins a <b>2 noms</b> o fins a <b>4</b>, de la
  candidatura que vulguis o de diverses. Surten elegides les persones amb més vots, siguin de la llista que siguin;
  si n'hi ha d'empatades, es fa un sorteig.</p>
  <p>Alguns municipis molt petits funcionen en <b>consell obert</b>: s'elegeix directament l'alcaldia, i les decisions
  del ple les pren l'assemblea de veïns. ${obert}</p>
  <p class="nota">A la fitxa dels municipis de llista oberta hi ha la taula «Aquí es vota persones», amb els vots de
  cada candidat a les darreres eleccions.</p>
</section>`;
}

/** Com es tria l'alcaldia, amb el poble de l'exemple. */
function seccioAlcaldia(cal: readonly FitaCalendari[]): string {
  const ple = cal.find((f) => f.id === "ple")!.des;
  const { files } = resolExempleDHondt();
  const dins = files.filter((f) => !f.exclosa);
  const majoria = absoluteMajority(EXEMPLE_DHONDT.regidories);
  const [primera, segona, tercera] = dins;
  // L'exemple només s'explica si fa el que diu: cap llista sola amb majoria, i
  // la segona i la tercera, juntes, sí.
  const exemple =
    primera && segona && tercera && primera.regidories < majoria && segona.regidories + tercera.regidories >= majoria
      ? `<p>Al poble de l'exemple, cap llista no té ${majoria} regidories de ${EXEMPLE_DHONDT.regidories}. Si la ${segona.id} i la
  ${tercera.id} voten juntes el cap de la ${segona.id}, en sumen ${segona.regidories + tercera.regidories} i l'alcaldia és seva. Si ningú
  no arriba a ${majoria}, l'alcaldia és del cap de la ${primera.id}, perquè és la llista més votada.</p>`
      : "";
  return `<section class="bloc" id="alcaldia">
  <h2>Com es tria l'alcaldia</h2>
  <p>L'alcaldia no es vota a la papereta. La trien els regidors el dia que es constitueix el ple nou, el
  vintè dia després de les eleccions: el ${escape(`${diaSetmana(ple)} ${dataCurta(ple)}`)} (data prevista; si hi ha
  un recurs contra els resultats, el dia 40è).</p>
  <ol class="mun-casos">
    <li><b>Hi poden optar els caps de llista</b>, el primer nom de cada candidatura que ha tret regidories.</li>
    <li><b>Si un té els vots de la majoria absoluta del ple</b>, la meitat més un dels regidors, és elegit.</li>
    <li><b>Si no n'hi ha cap</b>, és alcalde o alcaldessa el cap de la llista que ha tret més vots al municipi. Si dues empaten, es fa un sorteig.</li>
  </ol>
  ${exemple}
  <p>Als municipis de llista oberta pot ser candidat qualsevol regidor, i si cap no té la majoria absoluta,
  l'alcaldia és del regidor que va treure més vots. En consell obert, l'alcaldia la voten directament els veïns.</p>
</section>`;
}

/** Com canvia l'alcaldia a mig mandat. */
function seccioCanvis(base: string): string {
  return `<section class="bloc" id="canvis">
  <h2>Com pot canviar l'alcaldia a mig mandat</h2>
  <ul class="mun-casos">
    <li><b>Moció de censura.</b> La majoria absoluta del ple signa un escrit amb un altre candidat, i el ple el vota el
    desè dia hàbil després de registrar-lo. Si els firmants són de la llista de l'alcaldia, en calen més. Cada regidor
    en pot signar només una en tot el mandat.</li>
    <li><b>Qüestió de confiança.</b> Quan el ple rebutja el pressupost, les ordenances fiscals, el reglament orgànic o el
    planejament general, l'alcaldia pot lligar-hi el càrrec. Si torna a no sortir, cessa i el ple en tria una altra. Amb el
    pressupost és diferent: només cessa si en un mes prospera una moció de censura.</li>
    <li><b>Renúncia, mort o inhabilitació.</b> El ple torna a triar l'alcaldia amb les mateixes regles del primer dia, i a la
    llista de qui la tenia fa de cap de llista el nom següent.</li>
  </ul>
  <p class="nota">A cada fitxa de municipi hi ha qui ha tingut l'alcaldia des del 1979 i quan ha canviat. Als
  <a href="${escape(base)}ranquings/">rànquings</a>, quants anys fa que la mateixa força la té a cada municipi.</p>
</section>`;
}

/**
 * La lupa del botó de cerca, la mateixa de la portada (`portada.ts`, que no
 * l'exporta). Els dos botons «Busca el teu municipi» neixen amb `hidden`, com
 * el de la portada, perquè sense guió no hi hagi cap control que no faci res:
 * el guió del cercador (`cercador.ts`) els ensenya quan el document és sencer.
 */
const LUPA = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 L21 21"/></svg>`;

/** Les paraules de la pàgina, plegades al final: les mateixes definicions del glossari. */
const PARAULES: readonly ClauGlossari[] = [
  "cens-electoral", "vot-correu", "regidories", "llista-tancada", "llista-oberta", "barrera-5", "dhondt",
  "eleccio-alcaldia", "mocio-censura", "questio-confianca",
];

/**
 * La pàgina sencera, `observatori/municipals/index.html`.
 *
 * @param generatedAt Quan s'ha escrit: les fites d'abans d'aquest dia surten com a passades.
 * @param opcions El decret, quan ja sigui al BOE, i els municipis en consell obert.
 */
export function renderMunicipals(generatedAt: string, opcions: OpcionsMunicipals = {}): string {
  const base = "../";
  const avui = generatedAt.slice(0, 10);
  const cal = calendariMunicipals();
  const dia = cal.find((f) => f.id === "eleccions")!.des;
  const conv = cal.find((f) => f.id === "convocatoria")!.des;
  const decret = opcions.decret ?? null;
  const preguntes = preguntesMunicipals(cal, decret !== null);
  const url = `${SITE}/observatori/municipals/`;
  const diaEscrit = `${diaSetmana(dia)} ${dataCurta(dia)}`;
  const cap = capSeo({
    titol: "Com funcionen les municipals del 2027",
    descripcio: `Les municipals són el ${diaEscrit}. El calendari, qui pot votar, el vot per correu, com es reparteixen les regidories i com es tria l'alcaldia, amb l'article de la llei.`,
    url,
    tipus: "article",
    imatge: imatgeOg(FITXER_OG.global("municipals")),
    jsonLd: [filAriadna([...ARREL_OBSERVATORI, { nom: "Com funcionen les municipals", url }]), preguntesLd(preguntes, url)],
    fonts: [URL_LOREG, URL_INE_CERE],
  });
  const avis = decret
    ? `<p class="mun-avis">Dates fixades pel <a href="${escape(decret.url)}" rel="noopener">${escape(decret.nom)}</a>.</p>`
    : `<p class="mun-avis"><b>Data prevista segons la LOREG.</b> Les dates surten dels terminis de la llei electoral, comptats
  des del dia de votar. Seran oficials quan el decret de convocatòria surti al BOE, previsiblement ${escape(elDia(conv))}.</p>`;

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${cap}
${tipografia(base)}
<style>${RADIOGRAFIA_CSS}${MASCOTA_CSS}${GEO_CSS}${GLOSSARI_CSS}${MUNICIPALS_CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>

${capcalera(base, "municipals")}
${cercador(base)}

<main id="contingut">

<section class="mun-portada">
  <div class="presenta">${papereta(120, "pregunta")}<div>
    <p class="micro">Eleccions municipals</p>
    <h1>Com funcionen les municipals del 2027</h1>
  </div></div>
  <p class="entrada">El <b>${escape(diaEscrit)}</b> es vota als 947 municipis de Catalunya. Aquí hi ha el calendari,
  qui pot votar, com es reparteixen les regidories i com es tria l'alcaldia, explicat en pla i amb l'article de la llei al costat.</p>
  <p class="mun-cerca"><button type="button" class="obre-cerca" data-obre-cerca hidden>${LUPA}<span>Busca el teu municipi</span></button>
  <a href="${base}els947.html">Mira els 947, un per un</a></p>
</section>

<nav class="index" aria-label="Seccions d'aquesta pàgina">
  <a href="#calendari">Calendari</a>
  <a href="#qui-vota">Qui pot votar</a>
  <a href="#correu">Vot per correu</a>
  <a href="#escons">Les regidories</a>
  <a href="#dhondt">La llei d'Hondt</a>
  <a href="#alcaldia">L'alcaldia</a>
  <a href="#canvis">Canvis a mig mandat</a>
  <a href="#preguntes">Preguntes</a>
</nav>

<section class="bloc" id="calendari">
  <h2>El calendari</h2>
  ${avis}
  ${llistaCalendari(cal, avui)}
</section>

${seccioQuiVota(cal, base)}
${seccioEscons(base, opcions.consellObert)}
${seccioAlcaldia(cal)}
${seccioCanvis(base)}

<section class="bloc" id="observatori">
  <h2>I al teu municipi, què hi passa?</h2>
  <ul class="mun-salts">
    <li><button type="button" class="obre-cerca" data-obre-cerca hidden>${LUPA}<span>Busca el teu municipi</span></button>
    A la fitxa hi ha quantes regidories té el ple, qui hi governa i, a l'apartat <b>«Què t'hi jugues el 23 de maig del 2027»</b>,
    què es decideix a les properes eleccions.</li>
    <li><a href="${base}mapa/">El mapa</a>: qui té l'alcaldia a cada municipi, d'un cop d'ull.</li>
    <li><a href="${base}ranquings/">Els rànquings</a>: per exemple, on es va decidir el ple per menys vots el 2023.</li>
    <li><a href="${base}partit/">Els partits</a>: quantes alcaldies té cadascun, i on.</li>
  </ul>
</section>

<section class="bloc" id="preguntes">
  <h2>Preguntes ràpides</h2>
  ${cosPreguntes(preguntes)}
  ${renderGlossari(PARAULES, { titol: "Les paraules d'aquesta pàgina" })}
</section>

<section class="bloc fonts" id="fonts">
  <h2>Fonts</h2>
  <ul>
    <li><a href="${URL_LOREG}" rel="noopener">Llei orgànica 5/1985, del règim electoral general (LOREG)</a>, text consolidat al BOE (BOE-A-1985-11672): articles 2, 39, 42, 45, 47, 51, 53, 72 a 74, 84, 96, 163, 176, 179, 180, 184 i 195 a 198.</li>
    <li><a href="https://www.boe.es/eli/es/rd/2023/04/03/207" rel="noopener">Reial decret 207/2023, de 3 d'abril</a> (BOE-A-2023-8458): la convocatòria del 2023, amb què s'han comprovat els terminis.</li>
    <li><a href="${URL_INE_CERE}" rel="noopener">INE, Oficina del Cens Electoral</a>: cens dels ciutadans de la UE per a les municipals del 2027 (nota del 30 de setembre del 2026).</li>
    <li><a href="https://www.ine.es/prensa/elecmun23_1.pdf" rel="noopener">INE, nota de les municipals del 2023</a>: els països amb conveni i els anys de residència.</li>
    <li>Municipis en consell obert: fitxers de candidats del Ministeri de l'Interior, municipals del 2023.</li>
  </ul>
  <p class="nota">Aquesta pàgina explica les regles; no diu a qui votar ni si una regla és millor que una altra.</p>
</section>

</main>

${peu(base, generatedAt)}
</body>
</html>`;
}
