import type { VehiclesMetric } from "../jobs/j34-vehicles";
import { primers, type Curiositat, type FilaCuriosa, type FilaCuriositat } from "./curiositats";
import type { MedianaGrup } from "./medianes";

/**
 * «Quants vehicles hi ha»: el bloc de la fitxa amb el parc de vehicles del
 * municipi, i les dues curiositats que en surten per als 947.
 *
 * Tres decisions de forma, totes heretades de la resta de la fitxa:
 *
 *   · **Una tessel·la primer, i la taula després.** La xifra que es llegeix
 *     d'un cop d'ull és la de vehicles per 1.000 habitants, amb l'any i la
 *     mediana dels de la seva mida al peu, com les tires de la radiografia;
 *     el desglòs per menes va a una taula curta a sota.
 *   · **Cap veredicte.** Tenir més vehicles per habitant que els seus no és
 *     ni bo ni dolent: pot ser un poble dispers sense tren o un municipi on
 *     una empresa domicilia una flota. Es diu la xifra, amb qui es compara i
 *     què compta, i que jutgi qui llegeix.
 *   · **L'enllaç de l'Idescat és part de la dada.** Les condicions d'ús
 *     obliguen a posar-lo tal com l'ha donat l'API; si el municipi no en té
 *     de desat, s'enllaça la pàgina general de l'estadística a Idescat.cat.
 */

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const enter = (n: number): string => n.toLocaleString("ca-ES", { maximumFractionDigits: 0 });
const decimal = (n: number): string =>
  n.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Les tessel·les de la fitxa: el mateix HTML que `tira()` de radiografia.ts. */
function tira(t: { etq: string; xifra: string; peu?: string }): string {
  return `<li class="tira"><span class="etq">${escape(t.etq)}</span>
      <span class="xifra">${t.xifra}</span>
      ${t.peu ? `<span class="peu">${t.peu}</span>` : ""}</li>`;
}

/**
 * Amb què es compara la taxa: el que el job ha desat dins de la mètrica o,
 * si la fitxa en porta una de calculada a part (`medianes`), aquella. Les
 * dues diuen el mateix —mediana, quants i percentil dins del grup de mida— i
 * aquí es redueixen a una sola forma.
 */
function comparacioDe(
  dades: VehiclesMetric,
  medianes: MedianaGrup | null | undefined,
): { mediana: number; quants: number; etiqueta: string; percentil: number | null } | null {
  if (medianes) {
    return { mediana: medianes.mediana, quants: medianes.quants, etiqueta: medianes.etiqueta, percentil: medianes.percentil };
  }
  const c = dades.comparacio;
  if (!c) return null;
  return { mediana: c.mediana, quants: c.grup.ambDada, etiqueta: c.grup.etiqueta, percentil: c.percentil };
}

/**
 * A partir de quants vehicles per 1.000 habitants el parc ja no diu res dels
 * veïns. Rajadell (594 habitants) té 26.574 vehicles domiciliats, 45 per
 * persona; Aguilar de Segarra, 43; Torrebesses, 15. No són els cotxes dels
 * veïns: les empreses de rènting i lísing domicilien flotes senceres en
 * municipis on l'impost de vehicles (IVTM) és baix, i la DGT els compta allà
 * on són domiciliats. Per sobre de dos vehicles per habitant es tracta com a
 * flota: la fitxa ho diu així, i el rànquing deixa el municipi fora perquè
 * una taxa de 44.737 no és comparable amb cap altra.
 */
export const FLOTA_DOMICILIADA = 2000;

/** Si el parc és una flota domiciliada i no el dels veïns (vegeu `FLOTA_DOMICILIADA`). */
export function esFlota(perMil: number | null | undefined): boolean {
  return typeof perMil === "number" && perMil > FLOTA_DOMICILIADA;
}

/**
 * «El 2024 hi havia 70.297 vehicles domiciliats: 669 per cada 1.000
 * habitants, i 66 de cada 100 són turismes.» I quan és una flota: «26.574
 * vehicles domiciliats: 45 per cada habitant. No són els dels veïns…».
 */
function fraseObertura(dades: VehiclesMetric): string {
  let frase = `El ${dades.any} hi havia <b>${enter(dades.parc.total)}</b> vehicles domiciliats`;
  if (dades.perMil && esFlota(dades.perMil.total)) {
    const perPersona = dades.perMil.total / 1000;
    frase += `: <b>${perPersona.toLocaleString("ca-ES", { maximumFractionDigits: perPersona >= 10 ? 0 : 1 })} per cada habitant</b>. ` +
      "No són els dels veïns: les empreses de rènting i lísing domicilien flotes senceres en municipis on " +
      "l'impost de vehicles és baix, i la DGT els compta allà on són domiciliats. La xifra diu on hi ha " +
      "l'empresa, no com es mouen els veïns, i per això aquest municipi no entra al rànquing de vehicles per habitant";
    return `<p class="entrada-bloc">${frase}.</p>`;
  }
  if (dades.perMil) frase += `: <b>${enter(dades.perMil.total)} per cada 1.000 habitants</b>`;
  if (dades.pes) frase += `${dades.perMil ? ", i" : ":"} ${enter(dades.pes.turismes)} de cada 100 són turismes`;
  return `<p class="entrada-bloc">${frase}.</p>`;
}

/** La tessel·la principal i les dues de turismes i motocicletes. */
function tesselles(dades: VehiclesMetric, medianes: MedianaGrup | null | undefined): string {
  const tires: string[] = [];
  const c = comparacioDe(dades, medianes);
  if (dades.perMil) {
    const peu: string[] = [`${dades.any}`];
    // Amb una flota domiciliada la mediana i el percentil no diuen res:
    // el que compara és l'empresa, no el poble.
    if (c && esFlota(dades.perMil.total)) peu.push("flota domiciliada: no es compara amb els de la seva mida");
    else if (c) {
      peu.push(`la mediana dels ${enter(c.quants)} de la seva mida, <b>${enter(c.mediana)}</b>`);
      if (c.percentil !== null) peu.push(`percentil ${c.percentil}`);
    }
    tires.push(tira({ etq: "Vehicles per 1.000 habitants", xifra: enter(dades.perMil.total), peu: peu.join(" · ") }));
  } else {
    tires.push(tira({
      etq: "Vehicles per 1.000 habitants",
      xifra: "—",
      peu: `sense padró de l'any ${dades.any} no es pot fer la taxa`,
    }));
  }
  tires.push(tira({
    etq: "Turismes",
    xifra: enter(dades.parc.turismes),
    peu: [
      dades.perMil ? `${enter(dades.perMil.turismes)} per 1.000 hab.` : null,
      dades.pes ? `el ${decimal(dades.pes.turismes)}&nbsp;% del parc` : null,
    ].filter(Boolean).join(" · ") || undefined,
  }));
  tires.push(tira({
    etq: "Motocicletes",
    xifra: enter(dades.parc.motocicletes),
    peu: [
      dades.perMil ? `${enter(dades.perMil.motocicletes)} per 1.000 hab.` : null,
      dades.pes ? `el ${decimal(dades.pes.motocicletes)}&nbsp;% del parc` : null,
    ].filter(Boolean).join(" · ") || undefined,
  }));
  return `<ul class="tires">${tires.join("")}</ul>`;
}

/** El desglòs per menes: quants, quin pes tenen i quants per 1.000 habitants. */
function taulaParc(dades: VehiclesMetric): string {
  const total = dades.parc.total;
  const files: { nom: string; n: number | null; perMil: number | null }[] = [
    { nom: "Turismes", n: dades.parc.turismes, perMil: dades.perMil?.turismes ?? null },
    { nom: "Motocicletes", n: dades.parc.motocicletes, perMil: dades.perMil?.motocicletes ?? null },
    { nom: "Camions, furgonetes i tractors industrials", n: dades.parc.industrials, perMil: dades.perMil?.industrials ?? null },
    { nom: "Autobusos i altres", n: dades.parc.altres, perMil: dades.perMil?.altres ?? null },
    { nom: "Total", n: total, perMil: dades.perMil?.total ?? null },
  ];
  const cossos = files
    .map((f) => {
      const pes = f.n === null || total <= 0 ? null : (100 * f.n) / total;
      return `<tr>
      <th scope="row">${escape(f.nom)}</th>
      <td class="ara">${f.n === null ? "—" : enter(f.n)}</td>
      <td>${pes === null ? "—" : `${decimal(pes)}&nbsp;%`}</td>
      <td>${f.perMil === null ? "—" : enter(f.perMil)}</td>
    </tr>`;
    })
    .join("");
  return `<div class="taula-envolta"><table class="balanc vehicles">
  <thead><tr><th>Mena de vehicle</th><th>${dades.any}</th><th>del parc</th><th>per 1.000 hab.</th></tr></thead>
  <tbody>${cossos}</tbody>
  </table></div>`;
}

/** El peu amb la font, l'enllaç que obliga la llicència, el padró usat i la data. */
function peuFont(dades: VehiclesMetric): string {
  const href = dades.font.enllac?.href ?? dades.font.url;
  const padro = dades.poblacio
    ? dades.poblacio.anyPadro === null
      ? " La taxa es fa amb el padró vigent, perquè no hi ha cap padró prou proper a l'any de la dada."
      : dades.poblacio.anyPadro === dades.any
        ? ` La taxa es fa amb el padró del ${dades.poblacio.anyPadro} (${enter(dades.poblacio.habitants)} habitants).`
        : ` La taxa es fa amb el padró del ${dades.poblacio.anyPadro} (${enter(dades.poblacio.habitants)} habitants), el més proper a l'any de la dada.`
    : "";
  const actualitzat = dades.font.actualitzat ? `, actualitzat el ${escape(dades.font.actualitzat.slice(0, 10))}` : "";
  return `<p class="peu-nota">Font: <a href="${escape(href)}" rel="noopener nofollow">${escape(dades.font.organisme)}</a>,
  parc de vehicles del ${dades.any}${actualitzat}, consultat el ${escape(dades.font.consultat)}.${padro}
  La comparació és amb els municipis del mateix tram de població i només amb els que tenen la dada.</p>`;
}

/**
 * El contingut del bloc, sense la secció que l'embolcalla: és el que va a la
 * llista de blocs de la fitxa (`id`, `titol`, `html`) de radiografia.ts.
 * Mai retorna cadena buida: si l'Idescat no publica el municipi, ho diu.
 */
export function renderVehiclesBloc(dades: VehiclesMetric | null, medianes?: MedianaGrup | null): string {
  if (!dades) {
    return `<p class="entrada-bloc">L'Idescat no publica el parc de vehicles d'aquest municipi, i sense la xifra no
  hi ha res a comparar: un buit no és un zero.</p>
  <p class="peu-nota">Font consultada: <a href="https://www.idescat.cat/pub/?id=parcc" rel="noopener nofollow">Idescat,
  parc de vehicles, a partir de la DGT</a>.</p>`;
  }
  return `${fraseObertura(dades)}
  ${tesselles(dades, medianes)}
  ${taulaParc(dades)}
  <p class="nota">${escape(dades.nota)}</p>
  <p class="nota"><b>Què hi decideix l'ajuntament.</b> ${escape(dades.context.nota)}</p>
  ${peuFont(dades)}`;
}

/** El bloc sencer com a secció de la fitxa, amb el títol. */
export function renderVehicles(dades: VehiclesMetric | null, medianes?: MedianaGrup | null): string {
  return `<section class="bloc" id="vehicles">
  <h2>Quants vehicles hi ha</h2>
  ${renderVehiclesBloc(dades, medianes)}
</section>`;
}

// ------------------------------------------------------------ curiositats

/**
 * La fila dels 947 amb el que aquestes curiositats necessiten: vehicles per
 * 1.000 habitants (`veh`) i de quin any (`veha`), els mateixos noms que a
 * `Els947Row`. `null` o «no hi és» volen dir el mateix: absència.
 */
export type FilaVehicles = FilaCuriositat & { veh?: number | null; veha?: number | null };

const n = (v: number, d = 0): string =>
  v.toLocaleString("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d });

const municipi = (f: FilaVehicles): FilaCuriosa["municipi"] => ({ s: f.s, n: f.n, c: f.c });

/** L'any més freqüent entre les files amb dada, per dir el període amb una sola xifra. */
function anyMesComu(files: readonly FilaVehicles[]): number | null {
  const compte = new Map<number, number>();
  for (const f of files) if (typeof f.veha === "number") compte.set(f.veha, (compte.get(f.veha) ?? 0) + 1);
  let millor: number | null = null;
  for (const [any, quants] of compte) if (millor === null || quants > (compte.get(millor) ?? 0)) millor = any;
  return millor;
}

/**
 * Les dues curiositats del parc: on hi ha més vehicles que persones, i on
 * n'hi ha menys per habitant. Al format de `curiositats.ts`: cada fet diu
 * sobre quants municipis s'ha mirat, i sense cap dada no surt res.
 */
export function curiositatsVehicles(files: readonly FilaVehicles[]): Curiositat[] {
  const ambDada = files.filter((f): f is FilaVehicles & { veh: number } => typeof f.veh === "number" && f.veh >= 0);
  if (ambDada.length === 0) return [];
  const total = files.length;
  const any = anyMesComu(ambDada);
  const periode = any === null ? "darrer any publicat" : String(any);
  const font = "Idescat, a partir de la DGT · parc de vehicles";
  const cobertura = `S'ha mirat el parc de vehicles de ${n(ambDada.length)} municipis${ambDada.length < total ? ` dels ${n(total)}` : ""}.`;
  const filaDe = (f: FilaVehicles & { veh: number }): FilaCuriosa => ({
    municipi: municipi(f),
    valor: `${n(f.veh)} per 1.000 hab.`,
    detall: `${n(f.p)} habitants${typeof f.veha === "number" && f.veha !== any ? ` · dada del ${f.veha}` : ""}`,
  });
  const fets: Curiositat[] = [];

  // ---- més vehicles que persones ----------------------------------------
  const mesQuePersones = ambDada.filter((f) => f.veh > 1000);
  if (mesQuePersones.length > 0) {
    const { files: primeres, empatats } = primers(mesQuePersones, (f) => f.veh, (f) => f.n, 10, "max");
    fets.push({
      id: "mes-vehicles-que-persones",
      titol: "On hi ha més vehicles que persones",
      metode: `Municipis amb més de 1.000 vehicles domiciliats per cada 1.000 habitants del padró: n'hi ha ${n(mesQuePersones.length)}.`,
      periode,
      font,
      llistes: [{ cap: "Els que en tenen més per habitant", files: primeres.map(filaDe), empatats }],
      cobertura,
      cautela: "El parc compta els vehicles domiciliats al municipi, no els que hi circulen: una empresa de lloguer, una flota d'autocars o un concessionari poden posar-hi més vehicles que veïns. Als pobles molt petits, cent vehicles mouen molt la taxa.",
    });
  }

  // ---- menys vehicles per habitant --------------------------------------
  {
    const { files: darreres, empatats } = primers(ambDada, (f) => f.veh, (f) => f.n, 10, "min");
    fets.push({
      id: "menys-vehicles",
      titol: "On hi ha menys vehicles per habitant",
      metode: "Els municipis amb menys vehicles domiciliats per cada 1.000 habitants del padró.",
      periode,
      font,
      llistes: [{ cap: "Els que en tenen menys per habitant", files: darreres.map(filaDe), empatats }],
      cobertura,
      cautela: "Tenir pocs vehicles per habitant pot voler dir bon transport públic, un municipi dens o una població que no en necessita: la xifra no diu quina de les tres.",
    });
  }

  return fets;
}
