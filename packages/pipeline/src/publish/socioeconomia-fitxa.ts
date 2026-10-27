import { sumaMesos, type AturMunicipi, type IndicadorSocio, type SocioeconomiaMetric, type TaxaAproximada } from "../jobs/j44-socioeconomia";
import { consultatEl, dataCurta } from "../lib/text";
import { ambSigne, serieTemporal } from "./grafics";
import type { MedianaGrup } from "./medianes";
import { a, enFrase } from "./seo-ld";

/**
 * «Feina i renda»: el bloc de la fitxa amb el context socioeconòmic del
 * municipi que desa J44 (`kind = "socioeconomia"`): l'atur registrat del
 * SEPE mes a mes des de l'inici del mandat, la taxa aproximada, i quatre
 * indicadors de l'Idescat —l'índex socioeconòmic territorial, la base de
 * l'IRPF, la pensió mitjana i els estudis superiors—, cadascun amb el seu any.
 *
 * Tres decisions de forma, totes heretades de la resta de la fitxa:
 *
 *   · **Context, no balanç.** Cap d'aquestes xifres no la decideix el ple:
 *     l'atur, la renda i les pensions van amb l'economia i amb lleis que no
 *     vota cap ajuntament. Per això cap xifra porta color de veredicte ni cap
 *     fletxa que digui «millor» o «pitjor» (`amuntEsMillor: null`), i el bloc
 *     ho diu amb una frase, no amb una icona.
 *   · **Cada xifra amb el seu any.** Aquí conviuen el setembre del 2026,
 *     l'agost del 2026, el 2025, el 2024 provisional i el 2023. Barrejar-los
 *     sense dir-ho faria creure que és una foto del mateix moment.
 *   · **L'enllaç de l'Idescat és part de la dada**, com a vehicles-fitxa.ts:
 *     el que J18 va desar per a cada taula, verbatim, o la pàgina general de
 *     l'estadística. Del SEPE, «Origen de los datos: SEPE» i el darrer mes,
 *     que és el que demana el seu avís legal.
 */

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const enter = (n: number): string => n.toLocaleString("ca-ES", { maximumFractionDigits: 0 });
const decimal = (n: number): string =>
  n.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = (n: number): string => `${decimal(n)}&nbsp;%`;
const euros = (n: number): string => `${enter(n)}&nbsp;€`;

/**
 * «setembre del 2026», a partir de «2026-09». Es fa amb `dataCurta()` de
 * lib/text.ts, que és on viuen els noms dels mesos, i se'n treu el dia.
 */
export function mesEscrit(mes: string): string {
  return dataCurta(`${mes}-15`).replace(/^15 (de |d')/, "");
}

/** «al setembre del 2026», «a l'agost del 2026». */
export const alMes = (mes: string): string => {
  const text = mesEscrit(mes);
  return /^[aeiou]/.test(text) ? `a l'${text}` : `al ${text}`;
};

/** «del setembre del 2026», «de l'agost del 2026». */
export const delMes = (mes: string): string => {
  const text = mesEscrit(mes);
  return /^[aeiou]/.test(text) ? `de l'${text}` : `del ${text}`;
};

export type OpcionsSocioeconomia = {
  /** El nom del municipi, per a les frases. */
  nom?: string | null;
  /** Si la fitxa porta la mediana de la taxa calculada a part, mana sobre la desada. */
  medianes?: MedianaGrup | null;
};

/** Les tessel·les de la fitxa: el mateix HTML que `tira()` de radiografia.ts. */
function tira(t: { etq: string; xifra: string; peu?: string; espurna?: string }): string {
  return `<li class="tira"><span class="etq">${escape(t.etq)}</span>
      <span class="xifra">${t.xifra}</span>
      ${t.espurna ?? ""}
      ${t.peu ? `<span class="peu">${t.peu}</span>` : ""}</li>`;
}

/**
 * La ratlleta de l'atur mes a mes, del juny del 2023 al darrer mes.
 *
 * No és `serieTemporal()`: aquella funció va per anys, i amb mesos escriuria
 * «2023,42» a l'etiqueta i al text alternatiu. Aquesta fa el mateix que
 * l'espurna de la radiografia —sense eix, només la forma, al costat de la
 * xifra que diu el quant— i talla la línia allà on un mes és `<5`: dibuixar
 * per sobre d'un secret seria inventar-lo.
 */
export function espurnaMensual(valors: readonly (number | null)[], desDe: string): string {
  const amb = valors.map((v, i) => ({ i, v })).filter((p): p is { i: number; v: number } => p.v !== null);
  if (amb.length < 2) return "";
  const W = 118;
  const H = 34;
  const marge = 3;
  const min = Math.min(...amb.map((p) => p.v));
  const max = Math.max(...amb.map((p) => p.v));
  const x = (i: number): number => (valors.length === 1 ? 0 : (i * W) / (valors.length - 1));
  const y = (v: number): number => (max === min ? H / 2 : H - marge - ((v - min) / (max - min)) * (H - 2 * marge));
  let d = "";
  let anterior = -2;
  for (const p of amb) {
    d += `${p.i === anterior + 1 ? "L" : "M"}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)} `;
    anterior = p.i;
  }
  const primer = amb[0]!;
  const ultim = amb[amb.length - 1]!;
  const mesDe = (i: number): string => sumaMesos(desDe, i);
  const resum = `Atur registrat mes a mes: ${enter(primer.v)} persones ${alMes(mesDe(primer.i))} i ${enter(ultim.v)} ${alMes(
    mesDe(ultim.i),
  )}.${amb.length < valors.length ? " Els mesos amb menys de cinc persones la font no els publica." : ""}`;
  return `<span class="espurna socio-espurna">
    <svg viewBox="-2 -2 ${W + 4} ${H + 4}" role="img" aria-label="${escape(resum)}" preserveAspectRatio="none">
      <path d="${d.trim()}" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    </svg>
    <i aria-hidden="true"><b>${escape(mesEscrit(mesDe(primer.i)))}</b><b>${escape(mesEscrit(mesDe(ultim.i)))}</b></i>
  </span>`;
}

/** «2024, provisional», «2023», «agost del 2026». */
export function periodeText(p: IndicadorSocio["periode"]): string {
  if (p.mes) return mesEscrit(p.mes);
  return `${p.any ?? escape(p.text)}${p.provisional ? ", provisional" : ""}`;
}

/** «160 menys que…», «32 més que…», «les mateixes que…»: la diferència dita en paraules, sense adjectius. */
function diferencia(abs: number): string {
  if (abs === 0) return "les mateixes persones";
  return `${enter(Math.abs(abs))} ${abs < 0 ? "menys" : "més"}`;
}

/**
 * «Al setembre del 2026 hi havia 4.275 persones a l'atur registrat: 160
 * menys que al juny del 2023, quan va començar el mandat (−3,6 %). A tot
 * Catalunya, entre els mateixos dos mesos, +0,1 %.»
 */
function fraseObertura(dades: SocioeconomiaMetric, atur: AturMunicipi, nom: string | null | undefined): string {
  // «a Girona», «al Brull», «als Omells de na Gaia», com la resta de la web.
  const on = nom ? ` ${escape(a(enFrase(nom)))}` : "";
  if (atur.ara.total === null) {
    return `<p class="entrada-bloc">${alMes(atur.ara.mes).replace(/^a/, "A")} el SEPE no dona la xifra d'atur registrat${on}:
  quan hi ha menys de cinc persones, la font l'amaga per secret estadístic.</p>`;
  }
  let frase = `${alMes(atur.ara.mes).replace(/^a/, "A")} hi havia <b>${enter(atur.ara.total)} ${
    atur.ara.total === 1 ? "persona" : "persones"
  }</b> a l'atur registrat${on}`;
  const v = atur.respecteMandat;
  if (v) {
    frase += `: ${diferencia(v.absoluta)} que ${alMes(atur.iniciMandat.mes)}, quan va començar el mandat`;
    if (v.percent !== null && v.absoluta !== 0) frase += ` (${ambSigne(decimal, v.percent)}&nbsp;%)`;
  }
  frase += ".";
  const cat = dades.catalunya?.respecteMandat;
  if (v && cat && cat.percent !== null) {
    frase += ` A tot Catalunya, entre els mateixos dos mesos, ${ambSigne(decimal, cat.percent)}&nbsp;%.`;
  }
  return `<p class="entrada-bloc">${frase}</p>`;
}

/** Amb què es compara la taxa: la mediana calculada a part, si n'hi ha, o la que va desar el job. */
function comparacioTaxa(taxa: TaxaAproximada, medianes: MedianaGrup | null | undefined) {
  if (medianes) return { mediana: medianes.mediana, quants: medianes.quants, percentil: medianes.percentil };
  const c = taxa.comparacio;
  return c ? { mediana: c.mediana, quants: c.grup.ambDada, percentil: c.percentil } : null;
}

/** La xifra d'un indicador, en la seva unitat; el peu el posa qui crida. */
const XIFRA: Record<IndicadorSocio["clau"], (v: number) => string> = {
  ist: decimal,
  irpfBase: euros,
  pensio: (v) => euros(Math.round(v)),
  educacioSuperior: percent,
  afiliats: enter,
};

const ETIQUETA: Partial<Record<IndicadorSocio["clau"], { etq: string; peu: string }>> = {
  ist: { etq: "Índex socioeconòmic territorial", peu: "Catalunya = 100" },
  irpfBase: { etq: "Base de l'IRPF per declarant", peu: "mitjana per declaració" },
  pensio: { etq: "Pensió contributiva mitjana", peu: "al desembre" },
  educacioSuperior: { etq: "Amb estudis superiors", peu: "de la gent de 15 anys i més" },
};

function tesselles(dades: SocioeconomiaMetric, medianes: MedianaGrup | null | undefined): string {
  const tires: string[] = [];
  const atur = dades.atur;
  if (atur) {
    const peu = [escape(mesEscrit(atur.ara.mes))];
    if (atur.faUnAny.total !== null) peu.push(`${escape(mesEscrit(atur.faUnAny.mes))}: <b>${enter(atur.faUnAny.total)}</b>`);
    tires.push(tira({
      etq: "Atur registrat",
      xifra: atur.ara.total === null ? "menys de 5" : enter(atur.ara.total),
      espurna: espurnaMensual(atur.mensual.valors, atur.mensual.desDe),
      peu: peu.join(" · "),
    }));
  }
  if (dades.taxa) {
    const c = comparacioTaxa(dades.taxa, medianes);
    const peu = [`${escape(mesEscrit(dades.taxa.mes))} · aproximada`];
    if (c) {
      peu.push(`la mediana dels ${enter(c.quants)} de la seva mida, <b>${percent(c.mediana)}</b>`);
      if (c.percentil !== null) peu.push(`percentil ${c.percentil}`);
    }
    tires.push(tira({ etq: "Taxa d'atur aproximada", xifra: percent(dades.taxa.taxa), peu: peu.join(" · ") }));
  }
  for (const ind of dades.indicadors) {
    const et = ETIQUETA[ind.clau];
    if (!et || ind.valor === null) continue;
    tires.push(tira({ etq: et.etq, xifra: XIFRA[ind.clau](ind.valor), peu: `${et.peu} · ${escape(periodeText(ind.periode))}` }));
  }
  return tires.length > 0 ? `<ul class="tires socio-tires">${tires.join("")}</ul>` : "";
}

/**
 * La mitjana de cada any del 2019 ençà, amb `serieTemporal()` de mida
 * mitjana. Els anys sense mitjana —el 2020, que la font publica sense el
 * desembre, o un any amb algun mes amagat— van a `anysEsperats` i surten com
 * a forat, no com una línia que els salta.
 */
function serieAnual(atur: AturMunicipi): string {
  const punts = atur.anual.filter((a) => a.mitjana !== null).map((a) => ({ any: a.any, valor: a.mitjana! }));
  if (punts.length < 2) return "";
  const darrer = atur.anual[atur.anual.length - 1]!.any;
  return serieTemporal(punts, {
    titol: "Atur registrat, mitjana de l'any",
    format: (v) => `${enter(v)} persones`,
    mida: "mitjana",
    anysEsperats: atur.anual.map((a) => a.any),
    mandats: [{ desDe: 2023, finsA: Math.max(2027, darrer), etiqueta: "mandat 2023-2027" }],
    nota: "SEPE, mitjana dels dotze mesos",
  });
}

const NOMS_SECTORS: Record<keyof AturMunicipi["ara"]["sectors"], string> = {
  agricultura: "Agricultura",
  industria: "Indústria",
  construccio: "Construcció",
  serveis: "Serveis",
  senseOcupacioAnterior: "Sense feina anterior",
};

/** El darrer mes per sexe i per sector, amb el pes de cada fila sobre el total. */
function taulaMes(atur: AturMunicipi): string {
  const total = atur.ara.total;
  if (total === null || total === 0) return "";
  const fila = (nom: string, n: number | null): string => `<tr>
      <th scope="row">${escape(nom)}</th>
      <td class="ara">${n === null ? "—" : enter(n)}</td>
      <td>${n === null ? "—" : percent((100 * n) / total)}</td>
    </tr>`;
  const sexe = [fila("Dones", atur.ara.dones), fila("Homes", atur.ara.homes)].join("");
  const sectors = (Object.keys(NOMS_SECTORS) as (keyof typeof NOMS_SECTORS)[])
    .map((s) => fila(NOMS_SECTORS[s], atur.ara.sectors[s]))
    .join("");
  const amagats = [atur.ara.dones, atur.ara.homes, ...Object.values(atur.ara.sectors)].some((v) => v === null);
  return `<div class="taula-envolta"><table class="balanc socio-taula">
  <caption>Atur registrat ${escape(delMes(atur.ara.mes))}, per sexe i per sector de la darrera feina</caption>
  <thead><tr><th>Qui</th><th>Persones</th><th>del total</th></tr></thead>
  <tbody>${sexe}<tr class="socio-separa"><td colspan="3"></td></tr>${sectors}</tbody>
  </table></div>${
    amagats ? `<p class="peu-nota">«—»: la font amaga les xifres de menys de cinc persones, i amb una de tapada no es pot sumar.</p>` : ""
  }`;
}

/** El peu: «Origen de los datos: SEPE» amb el darrer mes, i l'enllaç de l'Idescat de cada indicador. */
function peuFont(dades: SocioeconomiaMetric): string {
  const sepe = dades.atur
    ? `Atur registrat: <a href="${escape(dades.font.sepe.url)}" rel="noopener nofollow">Origen de los datos: SEPE</a>,
  darrer mes publicat, ${escape(mesEscrit(dades.font.sepe.actualitzat))}, ${escape(consultatEl(dades.font.sepe.consultat))}.`
    : "";
  const idescat = dades.indicadors
    .map((i) => `<a href="${escape(i.enllac?.href ?? i.pagina)}" rel="noopener nofollow">${escape(i.nomApi || i.nom)}</a> (${escape(periodeText(i.periode))}; ${escape(i.font)})`)
    .join(", ");
  return `<p class="peu-nota">${sepe}${idescat ? ` Idescat: ${idescat}, ${escape(consultatEl(dades.font.idescat.consultat))}.` : ""}
  La taxa es compara amb els municipis del mateix tram de població i només amb els que la tenen.</p>`;
}

/**
 * El contingut del bloc, sense la secció que l'embolcalla: és el que va a la
 * llista de blocs de la fitxa (`id`, `titol`, `html`) de radiografia.ts.
 * Sense mètrica torna cadena buida i la fitxa no hi fa cap bloc: J44 encara
 * no ha passat, i dir «no se'n publica res» seria fals.
 */
export function renderSocioeconomiaBloc(dades: SocioeconomiaMetric | null, opcions: OpcionsSocioeconomia = {}): string {
  if (!dades || (!dades.atur && dades.indicadors.length === 0)) return "";
  const atur = dades.atur;
  const notes: string[] = [];
  if (atur) notes.push(`<p class="nota">${escape(dades.nota)}</p>`);
  if (atur && atur.mesosAmagats > 0) {
    notes.push(`<p class="nota">En ${enter(atur.mesosAmagats)} dels ${enter(atur.mensual.valors.length)} mesos del mandat hi havia
  menys de cinc persones a l'atur i el SEPE no en dona la xifra. Amb tan poca gent, cada persona mou molt la sèrie.</p>`);
  }
  if (dades.taxa) {
    notes.push(`<p class="nota">La taxa és aproximada: l'atur registrat dividit per l'atur registrat més les afiliacions a la
  Seguretat Social de la gent que hi viu, del mateix mes. No és la taxa d'atur de l'EPA, que no es calcula per municipis.</p>`);
  }
  return `${atur ? fraseObertura(dades, atur, opcions.nom) : ""}
  ${tesselles(dades, opcions.medianes)}
  ${atur ? serieAnual(atur) : ""}
  ${atur ? taulaMes(atur) : ""}
  ${notes.join("\n  ")}
  <p class="nota socio-context"><b>Què hi decideix l'ajuntament.</b> ${escape(dades.context.nota)}</p>
  ${peuFont(dades)}`;
}

/** El bloc sencer com a secció de la fitxa, amb el títol. */
export function renderSocioeconomia(dades: SocioeconomiaMetric | null, opcions: OpcionsSocioeconomia = {}): string {
  const cos = renderSocioeconomiaBloc(dades, opcions);
  return cos === "" ? "" : `<section class="bloc" id="feina-i-renda">
  <h2>Feina i renda</h2>
  ${cos}
</section>`;
}

/**
 * L'estil propi del bloc. La resta —tessel·les, espurna, taula, gràfica— ja
 * és de la fitxa (`estil.ts`, `GRAFICS_CSS`): aquí només hi ha el que és seu.
 */
export const SOCIOECONOMIA_CSS = `
.socio-espurna i b{font-weight:800}
.socio-taula caption{caption-side:top;text-align:left;font-weight:800;font-size:.85rem;color:var(--ink-suau);padding:0 0 6px}
.socio-taula td{font-variant-numeric:tabular-nums;text-align:right}
.socio-taula .socio-separa td{padding:0;border:0;height:6px}
.socio-context{border-left:3px solid var(--lavanda);padding-left:10px}
`;
