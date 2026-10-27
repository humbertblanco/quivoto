import {
  ANY_MANDAT,
  FONTS_URBANISME,
  figuraConeguda,
  type AnyProtegits,
  type FontUrbanisme,
  type UrbanismeHabitatgeMetric,
} from "../jobs/j40-urbanisme-habitatge";

/**
 * «Urbanisme i habitatge»: el bloc de la fitxa municipal que respon cinc
 * preguntes del veí amb les dades de J40. Quin pla urbanístic té el poble i de
 * quan és, quants pisos turístics hi ha, quina part del sou se'n va a pagar la
 * casa, quant habitatge protegit s'hi fa i si és zona tensa.
 *
 * Tres decisions de forma, heretades de la resta de la fitxa:
 *
 *   · **Primer la resposta, després la xifra.** Cada apartat obre amb una frase
 *     planera («Cadaqués es regeix per un pla general d'ordenació de cap al
 *     1987») i després porta les xifres compactes, cadascuna amb l'any. La
 *     font va al peu de l'apartat, no amagada al final de tot.
 *   · **Cap veredicte.** La font de l'Observatori del Territori diu «No compleix
 *     requisit» al costat del cost del lloguer; aquí no hi arriba, perquè J40
 *     no el desa. Un pla vell no és un pla dolent, i tenir molts pisos
 *     turístics no és ni bo ni dolent: es diu la xifra, l'any i d'on surt, i la
 *     referència de Catalunya quan la font la dona. Ni verds ni vermells: els
 *     colors són els neutres de la casa.
 *   · **«No consta» és una resposta.** Quan una xifra és `null` l'apartat ho
 *     diu, i explica per què si se sap (el cost del lloguer només el publiquen
 *     on hi ha prou dades). Un buit no és mai un zero. Els zeros que la font
 *     publica de debò (cap habitatge protegit acabat l'any passat) sí que es
 *     diuen com a zeros.
 *
 * Les classes van totes amb el prefix `urb-`: una classe nua com `.xifres li`
 * xoca amb el peu i amb les tessel·les.
 */

/** El que el bloc necessita saber del municipi, a part de les dades de J40. */
export type ContextUrbanisme = {
  /** El nom del municipi tal com surt a la fitxa («Cadaqués», «la Bisbal d'Empordà»). */
  nom: string;
};

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const enter = (n: number): string => n.toLocaleString("ca-ES", { maximumFractionDigits: 0 });
const decimal = (n: number): string =>
  n.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = (n: number): string => `${decimal(n)}&nbsp;%`;
/** Les ràtios per 100 habitants: als pobles petits són fraccions i cal un decimal o dos. */
const ratio = (n: number): string =>
  n.toLocaleString("ca-ES", { minimumFractionDigits: n < 1 ? 2 : 1, maximumFractionDigits: n < 1 ? 2 : 1 });

const MESOS = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];

/** «2024-03-16» → «16 de març del 2024»; «d'abril», «d'agost» i «d'octubre» amb apòstrof. */
export function dataLlarga(iso: string | null): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  const mes = MESOS[Number(m[2]) - 1];
  if (!mes) return null;
  const de = /^[aeiou]/.test(mes) ? "d'" : "de ";
  return `${Number(m[3])} ${de}${mes} del ${m[1]}`;
}

/** La primera lletra en minúscula: «Pla general d'ordenació» → «pla general d'ordenació». */
const minuscula = (text: string): string => text.charAt(0).toLocaleLowerCase("ca") + text.slice(1);
/** La primera lletra en majúscula, per als noms que comencen per article («la Bisbal»). */
const majuscula = (text: string): string => text.charAt(0).toLocaleUpperCase("ca") + text.slice(1);

/** Una xifra de la llista compacta: etiqueta, valor i, si cal, un peu petit. */
type Xifra = { etq: string; valor: string | null; peu?: string };

/** La llista compacta d'un apartat. Un valor `null` surt com a «no consta», mai com a zero. */
function xifres(llista: readonly Xifra[]): string {
  const files = llista.map((x) => {
    const valor = x.valor === null ? `<span class="urb-buit">no consta</span>` : x.valor;
    const peu = x.peu ? `<small>${x.peu}</small>` : "";
    return `<div><dt>${escape(x.etq)}</dt><dd>${valor}${peu}</dd></div>`;
  });
  return `<dl class="urb-xifres">${files.join("")}</dl>`;
}

/** La línia de font d'un apartat: l'organisme, el conjunt (enllaçat) i l'any de la dada. */
function liniaFont(font: Pick<FontUrbanisme, "nom" | "url">, quan: string | null): string {
  return `<p class="urb-font">Font: <a href="${escape(font.url)}" rel="noopener nofollow">${escape(font.nom)}</a>${
    quan ? `, ${quan}` : ""
  }.</p>`;
}

/** Un apartat sencer: títol, resposta, xifres i font. */
function apartat(id: string, titol: string, cos: string): string {
  return `<section class="urb-apartat" aria-labelledby="urb-${id}">
    <h3 id="urb-${id}">${escape(titol)}</h3>
    ${cos}
  </section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Els cinc apartats
// ─────────────────────────────────────────────────────────────────────────────

type Dades = UrbanismeHabitatgeMetric;

/** Les figures que són «unes normes»: femenines i plurals, i la frase ha de concordar. */
const esNormes = (figura: string | null): boolean => figura !== null && /^normes\b/i.test(figura);

/** «un pla general d'ordenació (PGO)», «unes normes subsidiàries…», «el Pla general metropolità (PGM)». */
function nomFigura(figura: string, sigla: string | null): string {
  const amb = sigla ? ` (${sigla})` : "";
  // El PGM és un de sol i té nom propi: «el», i amb majúscula.
  if (figura === "Pla general metropolità") return `el ${figura}${amb}`;
  return `${esNormes(figura) ? "unes" : "un"} ${minuscula(figura)}${amb}`;
}

/** «Quin pla urbanístic té i de quan és». */
export function apartatPla(dades: Dades, ctx: ContextUrbanisme): string {
  const p = dades.planejament;
  const font = dades.fonts.territori;
  if (!p) {
    return apartat("pla", "Quin pla urbanístic té i de quan és", `<p class="urb-resposta">La font no diu quin pla
    urbanístic general té ${escape(ctx.nom)} ni de quan és.</p>${liniaFont(font, null)}`);
  }
  const { que } = figuraConeguda(p.figura);
  const normes = esNormes(p.figura);
  const aprovat = normes ? "aprovades" : "aprovat";
  const tenia = normes ? "tenien" : "tenia";
  const quan =
    p.antiguitat === null || p.anyAprovacioAprox === null
      ? ""
      : p.antiguitat === 0
        ? `, ${aprovat} el ${p.any} mateix`
        : `, ${aprovat} cap al ${p.anyAprovacioAprox}: el ${p.any} ${tenia} ${enter(p.antiguitat)} ${p.antiguitat === 1 ? "any" : "anys"}`;
  const resposta = p.figura
    ? `${escape(majuscula(ctx.nom))} es regeix per ${escape(nomFigura(p.figura, p.sigla))}${quan}.`
    : `La font no diu quina figura de planejament té ${escape(ctx.nom)}.${
        p.antiguitat === null ? "" : ` El pla vigent tenia ${enter(p.antiguitat)} ${p.antiguitat === 1 ? "any" : "anys"} el ${p.any}.`
      }`;
  // «El POUM és…», però «Les NNSS són…»: les normes són femenines i plurals.
  const subjecte = p.sigla
    ? ["NNSS", "NPU"].includes(p.sigla) ? `Les ${p.sigla} són` : `El ${p.sigla} és`
    : p.figura ? `Un ${minuscula(p.figura)} és` : "";
  const explicacio = p.figura && que ? `<p class="urb-explica">${escape(subjecte)} ${escape(que)}.</p>` : "";
  const adaptat =
    p.adaptatLlei2002 === null
      ? null
      : p.adaptatLlei2002
        ? "sí"
        : "no";
  return apartat("pla", "Quin pla urbanístic té i de quan és", `<p class="urb-resposta">${resposta}</p>
    ${explicacio}
    ${xifres([
      { etq: "Pla general vigent", valor: p.figura ? escape(p.sigla ?? p.figura) : null, peu: p.sigla && p.figura ? escape(p.figura) : undefined },
      { etq: "Antiguitat", valor: p.antiguitat === null ? null : `${enter(p.antiguitat)} ${p.antiguitat === 1 ? "any" : "anys"}`, peu: `el ${p.any}` },
      { etq: "Aprovat", valor: p.anyAprovacioAprox === null ? null : `cap al ${p.anyAprovacioAprox}` },
      { etq: "Adaptat a la llei d'urbanisme del 2002", valor: adaptat },
    ])}
    ${liniaFont(font, `dades del ${p.any}`)}`);
}

/** «Pisos turístics». */
export function apartatPisos(dades: Dades, ctx: ContextUrbanisme): string {
  const t = dades.pisosTuristics;
  const font = dades.fonts.territori;
  if (!t) {
    return apartat("pisos", "Pisos turístics", `<p class="urb-resposta">La font no publica quants pisos turístics
    hi ha a ${escape(ctx.nom)}.</p>${liniaFont(font, null)}`);
  }
  let resposta: string;
  if (t.huts === null) resposta = `La font no diu quants pisos turístics hi havia el ${t.any}.`;
  else if (t.huts === 0) resposta = `El ${t.any} no hi constava cap pis turístic registrat.`;
  else {
    resposta = `El ${t.any} hi havia <b>${enter(t.huts)}</b> ${t.huts === 1 ? "pis turístic registrat" : "pisos turístics registrats"}`;
    if (t.placesHuts !== null) resposta += `, amb ${enter(t.placesHuts)} places`;
    if (t.hutsPer100 !== null) resposta += `: ${ratio(t.hutsPer100)} per cada 100 habitants`;
    resposta += ".";
  }
  return apartat("pisos", "Pisos turístics", `<p class="urb-resposta">${resposta}</p>
    ${xifres([
      { etq: "Pisos turístics", valor: t.huts === null ? null : enter(t.huts), peu: t.hutsPer100 === null ? undefined : `${ratio(t.hutsPer100)} per 100 hab.` },
      { etq: "Places en pisos turístics", valor: t.placesHuts === null ? null : enter(t.placesHuts) },
      {
        etq: "Places turístiques en total",
        valor: t.placesTuristiques === null ? null : enter(t.placesTuristiques),
        peu: t.placesTuristiquesPer100 === null ? undefined : `${ratio(t.placesTuristiquesPer100)} per 100 hab.`,
      },
    ])}
    <p class="urb-explica">Són els habitatges d'ús turístic inscrits al registre de la Generalitat: els que es
    lloguen sense inscriure-hi no hi surten. Les places turístiques totals inclouen les dels pisos turístics i les
    dels hotels, càmpings i altres establiments.</p>
    ${liniaFont(font, `dades del ${t.any}`)}`);
}

/** «Quant costa viure-hi»: el lloguer i la hipoteca sobre els ingressos. */
export function apartatCost(dades: Dades, ctx: ContextUrbanisme): string {
  const c = dades.cost;
  const font = dades.fonts.territori;
  const titol = "Quant costa viure-hi";
  if (!c) {
    return apartat("cost", titol, `<p class="urb-resposta">La font no publica quina part dels ingressos se'n va
    en lloguer o hipoteca a ${escape(ctx.nom)}: només fa la xifra on té prou dades. No vol dir que no costi res.</p>
    ${liniaFont(font, null)}`);
  }
  const lloguer = c.lloguerPerc === null ? null : `<b>${percent(c.lloguerPerc)}</b>`;
  const hipoteca = c.hipotecaPerc === null ? null : `<b>${percent(c.hipotecaPerc)}</b>`;
  const que =
    lloguer && hipoteca
      ? `el lloguer equival al ${lloguer} dels ingressos, i la quota de la hipoteca, al ${hipoteca}`
      : lloguer
        ? `el lloguer equival al ${lloguer} dels ingressos`
        : `la quota de la hipoteca equival al ${hipoteca} dels ingressos`;
  let resposta = `Segons l'Observatori del Territori, el ${c.any} ${que}.`;
  if (!lloguer) resposta += " Del lloguer, la font no en fa la xifra.";
  if (!hipoteca) resposta += " De la hipoteca, la font no en fa la xifra.";
  const cat = c.catalunya;
  const ambCat = cat !== null && (cat.lloguerPerc !== null || cat.hipotecaPerc !== null);
  const peuCat = (v: number | null | undefined): string | undefined =>
    typeof v === "number" ? `Catalunya, ${percent(v)}` : undefined;
  return apartat("cost", titol, `<p class="urb-resposta">${resposta}</p>
    ${xifres([
      { etq: "Lloguer sobre els ingressos", valor: c.lloguerPerc === null ? null : percent(c.lloguerPerc), peu: peuCat(cat?.lloguerPerc) },
      { etq: "Hipoteca sobre els ingressos", valor: c.hipotecaPerc === null ? null : percent(c.hipotecaPerc), peu: peuCat(cat?.hipotecaPerc) },
    ])}
    ${ambCat ? `<p class="urb-explica">La xifra de Catalunya hi és com a referència del mateix any, no com a nota.</p>` : ""}
    ${liniaFont(font, `dades del ${c.any}`)}`);
}

/** «Habitatge protegit»: la sèrie d'HPO i els habitatges acabats de l'any. */
export function apartatProtegit(dades: Dades, ctx: ContextUrbanisme): string {
  const p = dades.protegit;
  const a = dades.habitatgesAcabats;
  const titol = "Habitatge protegit";
  if (!p && !a) {
    return apartat("protegit", titol, `<p class="urb-resposta">La font no publica quants habitatges protegits
    s'han fet a ${escape(ctx.nom)}.</p>${liniaFont(dades.fonts.hpo, null)}`);
  }
  let resposta = "";
  if (p) {
    const d = p.darrer;
    const totZero = p.total !== null && p.total.iniciats === 0 && p.total.acabats === 0;
    if (totZero && p.total) {
      resposta = `Entre el ${p.total.des} i el ${p.total.fins} no hi consta cap habitatge protegit iniciat ni acabat.`;
    } else {
      const ini = d.iniciats === null ? "no consta quants se'n van iniciar" : `se'n van iniciar <b>${enter(d.iniciats)}</b>`;
      const aca = d.acabats === null ? "no consta quants se'n van acabar" : `se'n van acabar <b>${enter(d.acabats)}</b>`;
      resposta = `D'habitatges amb protecció oficial, el ${d.any} ${ini} i ${aca}.`;
      if (p.desDe2023) {
        resposta += ` Des del ${p.desDe2023.des}, l'any de les darreres municipals, ${enter(p.desDe2023.iniciats)} iniciats i ${enter(p.desDe2023.acabats)} acabats.`;
      }
    }
  }
  if (a && a.total !== null) {
    resposta += ` El ${a.any} s'hi van acabar ${enter(a.total)} habitatges en total${
      a.protegits === null ? "" : `, ${enter(a.protegits)} dels quals protegits`
    }.`;
  } else if (a && a.protegits !== null && !p) {
    resposta += ` El ${a.any} s'hi van acabar ${enter(a.protegits)} habitatges protegits; el total d'habitatges acabats no consta.`;
  }
  if (!p) resposta = `La font no publica la sèrie d'habitatge protegit de ${escape(ctx.nom)}.${resposta}`;
  const llista: Xifra[] = [];
  if (p) {
    llista.push({ etq: `Iniciats el ${p.darrer.any}`, valor: p.darrer.iniciats === null ? null : enter(p.darrer.iniciats) });
    llista.push({ etq: `Acabats el ${p.darrer.any}`, valor: p.darrer.acabats === null ? null : enter(p.darrer.acabats) });
    llista.push({
      etq: `Des del ${ANY_MANDAT}`,
      valor: p.desDe2023 ? `${enter(p.desDe2023.iniciats)} / ${enter(p.desDe2023.acabats)}` : null,
      peu: "iniciats / acabats",
    });
    llista.push({
      etq: p.total ? `Del ${p.total.des} al ${p.total.fins}` : "Tota la sèrie",
      valor: p.total ? `${enter(p.total.iniciats)} / ${enter(p.total.acabats)}` : null,
      peu: "iniciats / acabats",
    });
  }
  const fonts = [
    p ? liniaFont(dades.fonts.hpo, p.total ? `${p.total.des}-${p.total.fins}` : `dades fins al ${p.darrer.any}`) : "",
    a && (a.total !== null || (!p && a.protegits !== null)) ? liniaFont(dades.fonts.territori, `habitatges acabats del ${a.any}`) : "",
  ].join("");
  return apartat("protegit", titol, `<p class="urb-resposta">${resposta.trim()}</p>
    ${llista.length ? xifres(llista) : ""}
    ${p ? taulaSerie(p.serie) : ""}
    <p class="urb-explica">Qui promou aquests pisos pot ser l'ajuntament, la Generalitat, una cooperativa o una
    empresa privada: la xifra diu què s'ha fet al municipi, no qui ho ha fet.</p>
    ${fonts}`);
}

/** La sèrie d'HPO, any per any, plegada: el més recent a dalt. */
function taulaSerie(serie: readonly AnyProtegits[]): string {
  if (serie.length === 0) return "";
  const files = [...serie]
    .sort((x, y) => y.any - x.any)
    .map((f) => `<tr><th scope="row">${f.any}</th><td>${f.iniciats === null ? "—" : enter(f.iniciats)}</td><td>${
      f.acabats === null ? "—" : enter(f.acabats)
    }</td></tr>`)
    .join("");
  return `<details class="urb-detall"><summary>Any per any</summary>
    <div class="taula-envolta"><table class="balanc urb-taula">
    <thead><tr><th scope="col">Any</th><th scope="col">Iniciats</th><th scope="col">Acabats</th></tr></thead>
    <tbody>${files}</tbody></table></div></details>`;
}

/**
 * Què és una zona tensa, en una frase i amb la llei. És el mateix text a tots
 * els municipis, siguin zona tensa o no: el veí que llegeix «no» també ha de
 * saber de què li parlen.
 */
export const QUE_ES_ZONA_TENSA =
  "Una zona de mercat residencial tensat és un municipi on la Generalitat ha acreditat que costa especialment " +
  "accedir a un habitatge; la Llei estatal 12/2023, pel dret a l'habitatge (art. 18), hi permet limitar el preu " +
  "dels contractes de lloguer nous. La declaració dura tres anys i es pot prorrogar.";

/** «Zona tensa (topall de lloguer)». */
export function apartatZona(dades: Dades, ctx: ContextUrbanisme): string {
  const z = dades.zonaTensa;
  const font = dades.fonts.zones;
  const titol = "Zona tensa (topall de lloguer)";
  const actualitzada = dataLlarga(font.actualitzat);
  const quan = actualitzada ? `llista actualitzada el ${actualitzada}` : null;
  let resposta: string;
  let valor: string | null;
  let peu: string | undefined;
  if (!z) {
    resposta = `${escape(majuscula(ctx.nom))} no consta a la llista de zones tenses de la Generalitat, ni com a zona tensa ni com a municipi que no ho és.`;
    valor = null;
  } else if (z.zona === null) {
    resposta = `<b>No.</b> ${escape(majuscula(ctx.nom))} no és zona de mercat residencial tensat, i el topall de lloguer d'aquestes zones no s'hi aplica.`;
    valor = "No";
  } else {
    const des = dataLlarga(z.vigentDes);
    const grup = z.zona === "ZMRT1" ? "primera" : "segona";
    resposta = `<b>Sí.</b> ${escape(majuscula(ctx.nom))} és zona de mercat residencial tensat${des ? ` des del ${des}` : ""}, ` +
      `dins de la ${grup} llista que va declarar la Generalitat: el preu dels lloguers nous hi té topall.`;
    valor = "Sí";
    peu = `${z.zona === "ZMRT1" ? "ZMRT 1" : "ZMRT 2"}${des ? `, des del ${des}` : ""}`;
  }
  return apartat("zona", titol, `<p class="urb-resposta">${resposta}</p>
    ${xifres([{ etq: "Zona de mercat residencial tensat", valor, peu }])}
    <p class="urb-explica">${escape(QUE_ES_ZONA_TENSA)}</p>
    ${liniaFont(font, quan)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// El bloc
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La frase d'obertura del bloc, amb el que es pot dir d'un cop: el pla, els
 * pisos turístics i la zona tensa. «Cadaqués es regeix per un pla de cap al
 * 1987, hi havia 1.004 pisos turístics registrats el 2024 i és zona tensa.»
 * Si no se'n sap cap de les tres, torna una frase general.
 */
export function fraseObertura(dades: Dades, ctx: ContextUrbanisme): string {
  const parts: string[] = [];
  const p = dades.planejament;
  if (p?.anyAprovacioAprox != null) parts.push(`es regeix per un pla urbanístic de cap al ${p.anyAprovacioAprox}`);
  const t = dades.pisosTuristics;
  if (t?.huts != null) {
    parts.push(t.huts === 0
      ? `el ${t.any} no hi constava cap pis turístic registrat`
      : `el ${t.any} hi havia ${enter(t.huts)} ${t.huts === 1 ? "pis turístic registrat" : "pisos turístics registrats"}`);
  }
  if (dades.zonaTensa) parts.push(dades.zonaTensa.zona ? "és zona tensa, amb topall de lloguer" : "no és zona tensa");
  if (parts.length === 0) {
    return `<p class="entrada-bloc">Quin pla urbanístic té ${escape(ctx.nom)}, quants pisos turístics hi ha, què costa
  viure-hi, quant habitatge protegit s'hi fa i si el lloguer hi té topall.</p>`;
  }
  const llista = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} i ${parts[parts.length - 1]}`;
  return `<p class="entrada-bloc">${escape(majuscula(ctx.nom))} ${llista}.</p>`;
}

/** El peu comú: les tres fonts amb la llicència, la data d'actualització i la de consulta. */
function peuFonts(dades: Dades): string {
  const una = (f: FontUrbanisme): string => {
    const act = dataLlarga(f.actualitzat);
    return `<a href="${escape(f.url)}" rel="noopener nofollow">${escape(f.nom)}</a> (${escape(f.organisme)}; ${escape(f.llicencia)}${
      act ? `; actualitzat el ${act}` : ""
    })`;
  };
  const consultat = dataLlarga(dades.consultat) ?? dades.consultat;
  return `<p class="peu-nota urb-peu">Fonts: ${una(dades.fonts.territori)}, ${una(dades.fonts.hpo)} i ${una(dades.fonts.zones)}.
  Consultades el ${escape(consultat)}. Les xifres es publiquen tal com les dona la Generalitat, sense les etiquetes de
  «compleix» o «no compleix» que hi afegeix l'Observatori del Territori.</p>`;
}

/**
 * El contingut del bloc, sense la secció que l'embolcalla: és el que va a la
 * llista de blocs de la fitxa (`id`, `titol`, `html`) de radiografia.ts.
 * Mai retorna cadena buida: sense J40 executat, diu que no consta.
 */
export function renderUrbanismeHabitatgeBloc(dades: UrbanismeHabitatgeMetric | null, ctx: ContextUrbanisme): string {
  if (!dades) {
    const f = FONTS_URBANISME;
    return `<p class="entrada-bloc">No consta cap dada d'urbanisme ni d'habitatge de ${escape(ctx.nom)}: ni el pla
  urbanístic, ni els pisos turístics, ni l'habitatge protegit, ni si és zona tensa. Un buit no és un zero.</p>
  <p class="peu-nota urb-peu">Fonts consultades: <a href="${f.territori.url}" rel="noopener nofollow">${escape(f.territori.nom)}</a>,
  <a href="${f.hpo.url}" rel="noopener nofollow">${escape(f.hpo.nom)}</a> i
  <a href="${f.zones.url}" rel="noopener nofollow">${escape(f.zones.nom)}</a>.</p>`;
  }
  return `${fraseObertura(dades, ctx)}
  <div class="urb-apartats">
    ${apartatPla(dades, ctx)}
    ${apartatPisos(dades, ctx)}
    ${apartatCost(dades, ctx)}
    ${apartatProtegit(dades, ctx)}
    ${apartatZona(dades, ctx)}
  </div>
  <p class="nota"><b>Què hi decideix l'ajuntament.</b> L'ajuntament redacta i tramita el pla urbanístic, però
  l'aprovació definitiva és de la Generalitat. Amb el planejament pot limitar on s'obren pisos turístics i reservar
  sòl per a habitatge protegit. La zona tensa no la decideix l'ajuntament: la declara la Generalitat.</p>
  ${peuFonts(dades)}`;
}

/** El títol del bloc, per a la llista de seccions de la fitxa. */
export const TITOL_URBANISME = "La casa: el pla urbanístic, els pisos turístics i el que costa";

/** El bloc sencer com a secció de la fitxa, amb el títol. */
export function renderUrbanismeHabitatge(dades: UrbanismeHabitatgeMetric | null, ctx: ContextUrbanisme): string {
  return `<section class="bloc" id="urbanisme">
  <h2>${escape(TITOL_URBANISME)}</h2>
  ${renderUrbanismeHabitatgeBloc(dades, ctx)}
</section>`;
}

/**
 * L'estil propi del bloc. Cap ombra ni targeta: cada apartat és una franja
 * amb una línia de tinta a dalt, com les seccions de la resta de la fitxa.
 * Dues columnes a partir de 760 px; a 360 px, una sola i les xifres en dues.
 */
export const URBANISME_FITXA_CSS = `
.urb-apartats{display:grid;gap:var(--e3);margin-top:var(--e3)}
@media (min-width:760px){.urb-apartats{grid-template-columns:repeat(2,minmax(0,1fr))}}
.urb-apartat{border-top:2px solid var(--ink);padding-top:var(--e2);min-width:0}
.urb-apartat h3{font-family:var(--display);font-weight:800;font-size:1.12rem;line-height:1.25;margin:0 0 var(--e1)}
.urb-resposta{margin:0 0 var(--e2)}
.urb-explica{font-size:.9rem;color:var(--ink-suau);margin:var(--e2) 0 0}
.urb-xifres{display:grid;grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr));gap:var(--e2);margin:0}
.urb-xifres div{min-width:0;padding-left:var(--e1);border-left:3px solid var(--lavanda)}
.urb-xifres dt{font-size:.8rem;line-height:1.3;color:var(--ink-suau)}
.urb-xifres dd{margin:2px 0 0;font-family:var(--display);font-weight:800;font-size:1.3rem;line-height:1.2;
  font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.urb-xifres dd small{display:block;margin-top:2px;font-family:var(--text);font-weight:500;font-size:.76rem;color:var(--ink-suau)}
.urb-xifres .urb-buit{font-family:var(--text);font-weight:600;font-size:.95rem;color:var(--ink-suau);font-style:italic}
.urb-font{font-size:.76rem;color:var(--ink-suau);margin:var(--e1) 0 0}
.urb-detall{margin:var(--e2) 0 0}
.urb-detall summary{cursor:pointer;font-weight:700}
.urb-taula th,.urb-taula td{font-variant-numeric:tabular-nums}
.urb-taula td{text-align:right}
.urb-peu{max-width:70ch;margin-top:var(--e3)}
@media (max-width:420px){.urb-xifres{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
