import {
  PROCEDIMENTS,
  type AnyAbss,
  type AnyContractesEns,
  type FontServeis,
  type ProcedimentContracte,
  type ServeisEnsDesats,
  type ServeisSocialsDesats,
} from "../jobs/j42-serveis-ens";

/**
 * Els blocs de la J42 a les fitxes: «Els serveis socials que presta» i «Com
 * contracta» a la d'un consell o una diputació, i un tros petit per a la fitxa
 * dels municipis que són àrea bàsica de serveis socials pròpia.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES DECISIONS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · **Primer, què és.** Ningú no sap què és una àrea bàsica de serveis
 *     socials, i sense saber-ho «10.097 persones» no diu res. El bloc comença
 *     explicant-ho en dues frases, amb la llei que ho mana (la 12/2007), i
 *     després dona la xifra de l'últim any i la sèrie.
 *   · **Una persona no és una visita.** La font compta cada persona un cop
 *     l'any. Es diu al costat de la xifra, perquè és el malentès més probable.
 *   · **Qui dona la dada.** Si la font atribueix l'àrea a un consorci (la
 *     Garrotxa, el Ripollès, Osona des del 2023), es diu amb el nom del
 *     consorci: la pàgina del consell no pot dir que ho fa el consell sol.
 *   · **Un buit és un buit.** Un any sense dada surt com «no consta», amb la
 *     barra puntejada. Si la font hi havia escrit un zero que no pot ser, o si
 *     aquell any la fila venia amb el codi d'una altra comarca, una crida al
 *     peu ho explica.
 *   · **Com contracta, sense veredicte.** Es diu quants contractes, quant i
 *     per quin procediment, i què vol dir cada procediment. Un percentatge alt
 *     de contractes menors és normal en un ens que compra molt material petit;
 *     la pàgina no ho jutja. **Cap nom d'empresa**: és la regla de la J10, i
 *     el bloc acaba amb l'enllaç on es pot mirar cada contracte.
 *   · **Colors de marca, no de judici.** Els procediments tenen colors de la
 *     paleta (menta, préssec, lavanda, corall), com una llegenda qualsevol; cap
 *     verd ni vermell.
 *
 * Totes les classes porten el prefix `srv-`, i el CSS viu a
 * `SERVEIS_ENS_CSS`, que el qui pinta la pàgina ha d'afegir al seu `<style>`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Format
// ─────────────────────────────────────────────────────────────────────────────

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const enter = (n: number): string => Math.round(n).toLocaleString("ca-ES");
const decimal = (n: number, digits = 1): string =>
  n.toLocaleString("ca-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Un percentatge sense decimals, o amb un si queda per sota de l'u: «0,4 %» diu més que «0 %». */
const percent = (n: number): string => `${n > 0 && n < 1 ? decimal(n) : enter(n)}&nbsp;%`;

/** «113,4 milions d'euros», «554.000 euros»: el que es llegeix en veu alta. */
export function euros(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${decimal(n / 1_000_000)} milions d'euros`;
  if (Math.abs(n) >= 10_000) return `${enter(Math.round(n / 1_000) * 1_000)} euros`;
  return `${enter(n)} euros`;
}

function plural(n: number, un: string, molts: string): string {
  return n === 1 ? un : molts;
}

const LLEI_SERVEIS_SOCIALS = "https://portaljuridic.gencat.cat/eli/es-ct/l/2007/10/11/12";

/** «el consell», «la Diputació»: les paraules que canvien d'un ens a l'altre. */
function paraules(d: Pick<ServeisEnsDesats, "tipus">): { ens: string; Ens: string; delEns: string } {
  return d.tipus === "diputacio"
    ? { ens: "la Diputació", Ens: "La Diputació", delEns: "de la Diputació" }
    : { ens: "el consell", Ens: "El consell", delEns: "del consell" };
}

/** Una font citada al peu del bloc: nom enllaçat i data de consulta. */
function citaFonts(fonts: readonly FontServeis[]): string {
  return fonts
    .map((f) => `<a href="${escape(f.url)}" rel="noopener">${escape(f.nom)}</a>${f.consultat ? ` (consultat el ${escape(f.consultat)})` : ""}`)
    .join("; ");
}

/** L'últim any amb persones informades. */
export function darrerAnyAmbPersones(anys: readonly AnyAbss[]): AnyAbss | null {
  for (let i = anys.length - 1; i >= 0; i -= 1) if (anys[i]!.persones !== null) return anys[i]!;
  return null;
}

/** Una modalitat del SAD en text: «36 persones (4.262 hores)», o «no consta». */
function textSad(m: { persones: number | null; hores: number | null }): string {
  if (m.persones === null) return "no consta";
  const hores = m.hores !== null ? ` (${enter(m.hores)} ${plural(m.hores, "hora", "hores")})` : "";
  return `${enter(m.persones)} ${plural(m.persones, "persona", "persones")}${hores}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// La sèrie de persones ateses
// ─────────────────────────────────────────────────────────────────────────────

/** Les marques de peu de la sèrie: quines hi ha i què volen dir. */
const MARCA_ZERO = "*";
const MARCA_CODI = "†";

/**
 * La taula any per any: persones ateses amb una barra de menta proporcional a
 * l'any més alt, i les dues modalitats del SAD. La barra és decorativa
 * (`aria-hidden`): el número hi és sempre en text. Un any sense dada té la
 * barra buida i puntejada, i «no consta».
 */
export function taulaSerie(anys: readonly AnyAbss[]): string {
  const max = Math.max(0, ...anys.map((a) => a.persones ?? 0));
  const files = anys
    .map((a) => {
      const marques = `${a.zeroLlegitComBuit ? MARCA_ZERO : ""}${a.codiNoQuadra ? MARCA_CODI : ""}`;
      const sup = marques ? `<sup class="srv-marca">${marques}</sup>` : "";
      const ample = a.persones !== null && max > 0 ? Math.max(2, Math.round((a.persones / max) * 100)) : 0;
      const barra =
        a.persones === null
          ? `<span class="srv-barra srv-barra-buida" aria-hidden="true"></span>`
          : `<span class="srv-barra" aria-hidden="true"><span style="width:${ample}%"></span></span>`;
      return `<tr><th scope="row">${a.any}</th>
      <td class="srv-persones">${barra}<span class="srv-num">${a.persones !== null ? enter(a.persones) : "no consta"}${sup}</span></td>
      <td class="srv-num">${a.sadSocial.persones !== null ? enter(a.sadSocial.persones) : "no consta"}</td>
      <td class="srv-num">${a.sadDependencia.persones !== null ? enter(a.sadDependencia.persones) : "no consta"}</td></tr>`;
    })
    .join("");
  return `<div class="srv-flux"><table class="srv-taula">
    <caption class="srv-cap">Persones ateses cada any</caption>
    <thead><tr><th scope="col">Any</th><th scope="col">Serveis socials bàsics</th>
    <th scope="col">Ajuda a domicili social</th><th scope="col">Ajuda a domicili per dependència</th></tr></thead>
    <tbody>${files}</tbody>
  </table></div>`;
}

/** Les crides de peu de la taula, només les que hi surten. */
export function notesSerie(anys: readonly AnyAbss[]): string {
  const zeros = anys.filter((a) => a.zeroLlegitComBuit).map((a) => a.any);
  const codis = anys.filter((a) => a.codiNoQuadra).map((a) => a.any);
  const notes: string[] = [];
  if (zeros.length > 0) {
    notes.push(`${MARCA_ZERO} ${llistaAnys(zeros)}, la font hi escriu zero persones ateses. En una àrea bàsica que
      atén gent cada dia això vol dir que la dada no es va informar, i per això hi diem «no consta».`);
  }
  if (codis.length > 0) {
    notes.push(`${MARCA_CODI} ${llistaAnys(codis)}, la font porta les xifres de les comarques amb el codi d'una altra
      comarca. Les hem lligat pel nom, que és el que quadra amb els altres anys, però si la xifra queda molt lluny de
      les del costat, desconfieu-ne.`);
  }
  return notes.map((n) => `<p class="nota srv-crida">${n}</p>`).join("");
}

/** «El 2023», «El 2022 i el 2023», «El 2018, el 2019 i el 2023». */
function llistaAnys(anys: readonly number[]): string {
  const els = anys.map((a) => `el ${a}`);
  const text = els.length <= 1 ? els.join("") : `${els.slice(0, -1).join(", ")} i ${els[els.length - 1]}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «del 2023», «del 2018 al 2024», «dels anys 2018, 2019 i 2023». */
export function anysEnText(anys: readonly number[]): string {
  if (anys.length === 0) return "";
  if (anys.length === 1) return `del ${anys[0]}`;
  const seguits = anys.every((a, i) => i === 0 || a === anys[i - 1]! + 1);
  if (seguits) return `del ${anys[0]} al ${anys[anys.length - 1]}`;
  return `dels anys ${anys.slice(0, -1).join(", ")} i ${anys[anys.length - 1]}`;
}

/** «el Consorci…», «la Mancomunitat…»: l'article del nom d'un ens. */
export function ambArticle(nom: string): string {
  return /^(mancomunitat|comunitat|fundaci|agència|associaci|entitat)/i.test(nom.trim()) ? `la ${nom.trim()}` : `el ${nom.trim()}`;
}

/** «al Consorci…», «a la Mancomunitat…». */
export function aArticle(nom: string): string {
  const amb = ambArticle(nom);
  return amb.startsWith("la ") ? `a ${amb}` : `al ${amb.slice(3)}`;
}

/**
 * Qui ha donat la dada, si en algun any no ha estat l'ens: «Les xifres del
 * 2023 al 2024 les dona el Consorci d'Osona de Serveis Socials, no el consell
 * directament.» Els anys en què no hi ha gestor els dona l'ens mateix i no cal
 * dir-ho.
 */
export function notaGestors(anys: readonly AnyAbss[], ens: string): string {
  const perGestor = new Map<string, number[]>();
  for (const a of anys) {
    if (!a.gestor || (a.persones === null && a.sadSocial.persones === null && a.sadDependencia.persones === null)) continue;
    perGestor.set(a.gestor.nom, [...(perGestor.get(a.gestor.nom) ?? []), a.any]);
  }
  if (perGestor.size === 0) return "";
  const frases = [...perGestor].map(
    ([nom, llista]) =>
      `${llista.length === 1 ? "La xifra" : "Les xifres"} ${anysEnText(llista)} ${llista.length === 1 ? "la dona" : "les dona"} ` +
      `${escape(ambArticle(nom))}, no ${escape(ens)} directament.`,
  );
  return `<p class="srv-gestor">${frases.join(" ")}</p>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// «Els serveis socials que presta» (consells)
// ─────────────────────────────────────────────────────────────────────────────

/** El paràgraf que explica què és una àrea bàsica, igual a totes les fitxes de consell. */
const QUE_ES_ABSS = `<p class="entrada-bloc">Quan algú necessita ajuda —una família que no arriba a final de mes,
  una persona gran que ja no es pot valer sola— la porta d'entrada són els serveis socials bàsics: el
  treballador o la treballadora social, l'educador social, l'ajuda a domicili. La
  <a href="${LLEI_SERVEIS_SOCIALS}" rel="noopener">Llei 12/2007, de serveis socials</a>, els organitza en
  <b>àrees bàsiques</b>: cada municipi de més de 20.000 habitants en té una de pròpia, i els més petits
  s'agrupen per comarques, i aquesta àrea la gestiona el consell comarcal.</p>`;

/**
 * El bloc «Els serveis socials que presta», per a la fitxa d'un consell
 * comarcal. A les diputacions torna una cadena buida: no gestionen cap àrea
 * bàsica, i un bloc que digués «no consta» faria pensar que n'haurien de tenir.
 */
export function renderServeisSocialsEns(d: ServeisEnsDesats): string {
  if (d.tipus !== "consell") return "";
  const p = paraules(d);
  const s = d.serveisSocials;
  const darrer = s ? darrerAnyAmbPersones(s.anys) : null;
  const altres = renderAltresArees(d);
  if (!s || !darrer) {
    return `<section class="bloc srv" id="serveis-socials">
  <h2>Els serveis socials que presta</h2>
  ${QUE_ES_ABSS}
  <p>La font no publica cap xifra de persones ateses a l'àrea bàsica ${escape(p.delEns)}.</p>
  ${altres}
  ${s ? `<p class="nota">Font: ${citaFonts(s.fonts)}.</p>` : ""}
</section>`;
  }
  const qui = darrer.gestor
    ? ` La font l'atribueix ${escape(aArticle(darrer.gestor.nom))}, no ${escape(p.ens)} directament.`
    : "";
  const sad =
    darrer.sadSocial.persones !== null || darrer.sadDependencia.persones !== null
      ? `<p>Aquell any, l'ajuda a domicili va arribar a ${textSad(darrer.sadSocial)} per vulnerabilitat o risc
    social, i a ${textSad(darrer.sadDependencia)} amb un pla d'atenció per dependència.</p>`
      : `<p>De l'ajuda a domicili d'aquell any, la font no en dona cap xifra.</p>`;
  return `<section class="bloc srv" id="serveis-socials">
  <h2>Els serveis socials que presta</h2>
  ${QUE_ES_ABSS}
  <p class="srv-xifra"><span class="srv-gran">${enter(darrer.persones!)}</span>
    <span>persones ateses el ${darrer.any} a l'àrea bàsica ${escape(p.delEns)}.${qui}</span></p>
  <p class="srv-aclariment">Cada persona compta un cop, encara que hi hagi anat deu vegades. Els municipis de més de
  20.000 habitants de la comarca tenen àrea pròpia i no hi són.</p>
  ${sad}
  ${taulaSerie(s.anys)}
  ${notesSerie(s.anys)}
  ${notaGestors(s.anys, p.ens)}
  ${altres}
  <p class="nota">Font: ${citaFonts(s.fonts)}. La font no publica el pressupost ni els professionals de cada àrea.</p>
</section>`;
}

/** Les altres àrees bàsiques no municipals de la comarca: «També hi ha la de la Mancomunitat La Plana…». */
function renderAltresArees(d: ServeisEnsDesats): string {
  if (d.altresArees.length === 0) return "";
  const items = d.altresArees.map(
    (a) =>
      `${escape(ambArticle(a.nom))}${a.persones !== null ? ` (${enter(a.persones)} persones ateses el ${a.any})` : ""}`,
  );
  const llista = items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} i ${items[items.length - 1]}`;
  const una = items.length === 1;
  return `<p class="srv-altres">A la comarca hi ha ${una ? "una altra àrea bàsica" : "altres àrees bàsiques"}
  que no ${una ? "és" : "són"} ${escape(paraules(d).delEns)} i que aquí no es ${una ? "compta" : "compten"}:
  ${una ? "la" : "les"} de ${llista}.</p>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// «Com contracta»
// ─────────────────────────────────────────────────────────────────────────────

/** Com es diu cada procediment a la pàgina, i què vol dir, en una frase. */
export const PROCEDIMENT_TEXT: Readonly<Record<ProcedimentContracte, { nom: string; que: string }>> = {
  obert: { nom: "Obert", que: "s'anuncia i s'hi pot presentar qualsevol empresa" },
  menor: {
    nom: "Menor",
    que: "per a imports petits (menys de 15.000 euros en serveis i subministraments, menys de 40.000 en obres, sense IVA); la llei no obliga a demanar més d'una oferta",
  },
  negociat: { nom: "Negociat", que: "l'ens negocia les condicions amb una o poques empreses" },
  acordMarc: {
    nom: "Acord marc o sistema dinàmic",
    que: "es tria entre les empreses que ja van guanyar un concurs previ",
  },
  altres: { nom: "Altres", que: "restringit, emergències, adjudicació directa i altres camins poc freqüents" },
};

/** La classe de color de cada procediment: colors de la paleta, sense cap sentit de judici. */
const CLASSE_PROCEDIMENT: Readonly<Record<ProcedimentContracte, string>> = {
  obert: "srv-p-obert",
  menor: "srv-p-menor",
  negociat: "srv-p-negociat",
  acordMarc: "srv-p-acord",
  altres: "srv-p-altres",
};

/** L'any de referència: l'últim complet; si no n'hi ha cap, l'últim que hi ha. */
export function anyDeReferencia(anys: readonly AnyContractesEns[]): AnyContractesEns | null {
  const complets = anys.filter((a) => a.complet);
  return complets[complets.length - 1] ?? anys[anys.length - 1] ?? null;
}

/** La part d'un procediment sobre el total, en percentatge; `null` si el total és zero. */
export function partDe(any: AnyContractesEns, procediment: ProcedimentContracte, per: "contractes" | "import"): number | null {
  const total = per === "contractes" ? any.contractes : any.import ?? 0;
  if (total <= 0) return null;
  const p = any.perProcediment.find((x) => x.procediment === procediment);
  return p ? (100 * p[per]) / total : 0;
}

/**
 * Una barra apilada per procediment: per nombre de contractes o per import.
 * Els trossos són decoratius; el text de la llegenda porta els números.
 */
function barraApilada(any: AnyContractesEns, per: "contractes" | "import", etiqueta: string): string {
  const trossos = PROCEDIMENTS.map((p) => ({ p, part: partDe(any, p, per) ?? 0 })).filter((t) => t.part > 0);
  if (trossos.length === 0) return "";
  const segments = trossos
    .map((t) => `<span class="srv-tros ${CLASSE_PROCEDIMENT[t.p]}" style="width:${t.part.toFixed(2)}%"></span>`)
    .join("");
  return `<div class="srv-fila-barra"><span class="srv-etq">${escape(etiqueta)}</span>
    <span class="srv-apilada" aria-hidden="true">${segments}</span></div>`;
}

/** La llegenda de les barres, amb els números de cada procediment que hi surt. */
function llegendaProcediments(any: AnyContractesEns): string {
  const items = any.perProcediment
    .filter((p) => p.contractes > 0)
    .map((p) => {
      const t = PROCEDIMENT_TEXT[p.procediment];
      const partN = partDe(any, p.procediment, "contractes");
      const partI = partDe(any, p.procediment, "import");
      const xifres = [
        `${enter(p.contractes)} ${plural(p.contractes, "contracte", "contractes")}${partN !== null ? ` (${percent(partN)})` : ""}`,
        any.import !== null ? `${euros(p.import)}${partI !== null ? ` (${percent(partI)})` : ""}` : null,
      ].filter(Boolean);
      return `<li><span class="srv-mostra ${CLASSE_PROCEDIMENT[p.procediment]}" aria-hidden="true"></span>
      <span><b>${escape(t.nom)}</b>: ${xifres.join(", ")}. <span class="srv-que">${escape(t.que.charAt(0).toUpperCase() + t.que.slice(1))}.</span></span></li>`;
    })
    .join("");
  return `<ul class="srv-llegenda">${items}</ul>`;
}

/** La taula any per any: quants, quant, i les dues parts que més es pregunten. */
function taulaContractes(anys: readonly AnyContractesEns[]): string {
  const files = anys
    .map((a) => {
      const menors = partDe(a, "menor", "contractes");
      const oberts = partDe(a, "obert", "import");
      return `<tr><th scope="row">${a.any}${a.complet ? "" : ' <span class="srv-encurs">en curs</span>'}</th>
      <td class="srv-num">${enter(a.contractes)}</td>
      <td class="srv-num">${a.import !== null ? euros(a.import) : "no consta"}</td>
      <td class="srv-num">${menors !== null ? percent(menors) : "—"}</td>
      <td class="srv-num">${oberts !== null ? percent(oberts) : "—"}</td></tr>`;
    })
    .join("");
  return `<div class="srv-flux"><table class="srv-taula">
    <caption class="srv-cap">Contractes nous inscrits cada any</caption>
    <thead><tr><th scope="col">Any</th><th scope="col">Contractes</th><th scope="col">Import adjudicat</th>
    <th scope="col">Menors, sobre el nombre</th><th scope="col">Oberts, sobre l'import</th></tr></thead>
    <tbody>${files}</tbody>
  </table></div>`;
}

/** Què compra: els tipus de contracte de l'any de referència, de més a menys import. */
function llistaTipus(any: AnyContractesEns): string {
  if (any.perTipus.length === 0 || any.import === null) return "";
  const items = any.perTipus
    .filter((t) => t.contractes > 0)
    .map((t) => `<li><b>${escape(t.tipus)}</b>: ${euros(t.import)} en ${enter(t.contractes)} ${plural(t.contractes, "contracte", "contractes")}</li>`)
    .join("");
  return `<h3 class="srv-sub">Què compra, el ${any.any}</h3><ul class="srv-tipus">${items}</ul>`;
}

/**
 * El bloc «Com contracta», per a la fitxa d'un consell o d'una diputació.
 * Sense contractes inscrits, el bloc hi és igual i ho diu: un buit al registre
 * no vol dir que l'ens no compri res.
 */
export function renderContractacioEns(d: ServeisEnsDesats): string {
  const p = paraules(d);
  const c = d.contractacio;
  const ref = c ? anyDeReferencia(c.anys) : null;
  if (!c || !ref) {
    return `<section class="bloc srv" id="contractacio">
  <h2>Com contracta</h2>
  <p>El Registre públic de contractes no té cap contracte inscrit per ${escape(p.ens)} des del 2021. No vol dir que
  no compri res: pot ser que no els hi inscrigui, o que ho faci a través d'un altre organisme.</p>
</section>`;
  }
  const import_ = ref.import !== null ? ` per un total de <b>${euros(ref.import)}</b>` : "";
  const menors = partDe(ref, "menor", "contractes");
  const oberts = partDe(ref, "obert", "import");
  const parts = [
    menors !== null ? `per nombre, el ${percent(menors)} van ser contractes menors` : null,
    oberts !== null && ref.import !== null ? `per import, els oberts en sumen el ${percent(oberts)}` : null,
  ].filter(Boolean);
  const senseMenors = ref.perProcediment.find((x) => x.procediment === "menor")?.contractes === 0
    ? ` No hi consta cap contracte menor, cosa que no vol dir que no se'n fessin: pot ser que no s'hagin inscrit.`
    : "";
  const senseImport = ref.senseImport > 0
    ? ` ${enter(ref.senseImport)} ${plural(ref.senseImport, "contracte no porta", "contractes no porten")} import i no ${plural(ref.senseImport, "entra", "entren")} a la suma.`
    : "";
  return `<section class="bloc srv" id="contractacio">
  <h2>Com contracta</h2>
  <p class="entrada-bloc">Cada contracte nou que signa ${escape(p.ens)} s'ha d'inscriure al Registre públic de contractes.
  D'allà surt quants n'ha fet cada any, per quant, i per quin camí: un concurs obert a tothom, un contracte menor
  o una altra via.</p>
  <p class="srv-xifra"><span class="srv-gran">${enter(ref.contractes)}</span>
    <span>contractes nous el ${ref.any}${ref.complet ? "" : " (any en curs, encara incomplet)"}${import_}.</span></p>
  ${parts.length > 0 ? `<p>${parts.join("; ").replace(/^p/, "P")}.${senseMenors}${senseImport}</p>` : ""}
  ${barraApilada(ref, "contractes", "Per nombre")}
  ${barraApilada(ref, "import", "Per import")}
  ${llegendaProcediments(ref)}
  ${llistaTipus(ref)}
  ${c.anys.length > 1 ? taulaContractes(c.anys) : ""}
  <p class="nota">Un lot compta com un contracte. Només hi ha les adjudicacions i els contractes menors: les
  pròrrogues i modificacions de contractes que ja hi eren no es compten. L'any és el d'inici del contracte, com el
  classifica el registre, i l'import és el d'adjudicació que hi consta. Només ${escape(p.ens)} mateix: els seus
  organismes i empreses, si en té, contracten pel seu compte. No hi ha cap nom d'empresa a propòsit: qui vulgui saber
  qui ha guanyat cada contracte ho pot mirar a la <a href="${escape(c.detall)}" rel="noopener">Plataforma de serveis de
  contractació pública</a>. Font: ${citaFonts([c.font])}.</p>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Els dos blocs junts, i el tros de la fitxa municipal
// ─────────────────────────────────────────────────────────────────────────────

/** Els dos blocs de la J42 per a la fitxa d'un ens, un darrere l'altre. */
export function renderServeisEns(d: ServeisEnsDesats): string {
  return `${renderServeisSocialsEns(d)}\n${renderContractacioEns(d)}`;
}

/** L'índex de seccions de la fitxa de l'ens: els enllaços als blocs que hi ha. */
export function enllacosIndexServeis(d: ServeisEnsDesats): string {
  return [
    d.tipus === "consell" ? '<a href="#serveis-socials">Serveis socials</a>' : "",
    '<a href="#contractacio">Com contracta</a>',
  ].filter(Boolean).join("\n  ");
}

/**
 * El tros de la fitxa d'un municipi que és àrea bàsica de serveis socials
 * pròpia. Petit a propòsit: una frase amb la xifra de l'últim any, l'ajuda a
 * domicili, la sèrie plegada dins un `<details>` i la font. Si es dona la
 * població, s'hi afegeix la proporció aproximada, arrodonida a la unitat i
 * dient de quin any és el padró; no es compara amb ningú.
 *
 * Sense cap any amb persones informades torna una cadena buida: el municipi
 * és àrea bàsica, però la fitxa no té res a dir-ne. No porta `id`: el posa el
 * bloc de la fitxa que l'acull.
 */
export function renderServeisSocialsMunicipi(
  d: ServeisSocialsDesats,
  opcions: { poblacio?: number | null; anyPoblacio?: number | null } = {},
): string {
  const darrer = darrerAnyAmbPersones(d.anys);
  if (!darrer) return "";
  const { poblacio, anyPoblacio } = opcions;
  const proporcio =
    poblacio && poblacio > 0
      ? ` Són unes ${enter((100 * darrer.persones!) / poblacio)} de cada 100 habitants${anyPoblacio ? ` (padró del ${anyPoblacio})` : ""}.`
      : "";
  const sad =
    darrer.sadSocial.persones !== null || darrer.sadDependencia.persones !== null
      ? `<p>L'ajuda a domicili, aquell any: ${textSad(darrer.sadSocial)} per vulnerabilitat o risc social, i
    ${textSad(darrer.sadDependencia)} per dependència.</p>`
      : "";
  return `<section class="srv srv-municipi">
  <h3 class="srv-sub">Quanta gent atenen els serveis socials</h3>
  <p>Els municipis de més de 20.000 habitants tenen àrea bàsica de serveis socials pròpia
  (<a href="${LLEI_SERVEIS_SOCIALS}" rel="noopener">Llei 12/2007</a>), i aquest en té una. El ${darrer.any} hi
  van atendre <b>${enter(darrer.persones!)} persones</b>; cada persona compta un cop, encara que hi anés més
  vegades.${proporcio}</p>
  ${sad}
  <details class="nota srv-detall"><summary>Any per any, des del ${d.anys[0]?.any ?? darrer.any}</summary>
    ${taulaSerie(d.anys)}
    ${notesSerie(d.anys)}
  </details>
  <p class="nota">Font: ${citaFonts(d.fonts)}.</p>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estil
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Només el que no tenia ja `RADIOGRAFIA_CSS`. La xifra gran va en Gabarito
 * (`--display`), com les de la portada; les barres són de menta i els trossos
 * de procediment fan servir la paleta de la casa amb una vora de tinta, perquè
 * en mode fosc els fons clars continuïn separant-se del paper. L'acord marc va
 * de corall i no de blanc: un tros blanc sobre el fons blanc de la barra
 * semblava un buit.
 */
export const SERVEIS_ENS_CSS = `
.srv-xifra{display:flex;align-items:baseline;gap:var(--e2);flex-wrap:wrap;margin:var(--e2) 0 var(--e1)}
.srv-gran{font-family:var(--display);font-weight:800;font-size:clamp(2.4rem,9vw,3.6rem);line-height:1;color:var(--ink)}
.srv-xifra > span:last-child{flex:1 1 16rem;min-width:0}
.srv-aclariment,.srv-gestor,.srv-altres{color:var(--ink-suau);max-width:70ch}
.srv-sub{font-family:var(--display);font-size:1.15rem;margin:var(--e3) 0 var(--e1)}
.srv-flux{overflow-x:auto;margin:var(--e2) 0}
.srv-taula{width:100%;border-collapse:collapse;font-size:.9rem;font-variant-numeric:tabular-nums}
.srv-cap{text-align:left;font-weight:700;padding-bottom:var(--e1)}
.srv-taula th,.srv-taula td{text-align:left;padding:8px 10px 8px 0;border-bottom:1px solid var(--vora);vertical-align:middle}
.srv-taula thead th{font-size:.8rem;color:var(--ink-suau);font-weight:700}
.srv-num{white-space:nowrap}
.srv-persones{display:flex;align-items:center;gap:var(--e1);min-width:12rem}
.srv-barra{flex:1 1 auto;height:12px;border-radius:var(--r-s);background:var(--paper-2);border:1.5px solid var(--ink);overflow:hidden;max-width:14rem}
.srv-barra > span{display:block;height:100%;background:var(--menta)}
.srv-barra-buida{border-style:dashed;border-color:var(--ink-suau);background:transparent}
.srv-marca{font-weight:800;color:var(--coral-text);margin-left:2px}
.srv-crida{max-width:70ch}
.srv-encurs{font-size:.75rem;font-weight:700;color:var(--ink-suau)}
.srv-fila-barra{display:grid;grid-template-columns:6.5rem 1fr;align-items:center;gap:var(--e1);margin:var(--e1) 0}
.srv-etq{font-size:.85rem;font-weight:700;color:var(--ink-suau)}
.srv-apilada{display:flex;height:22px;border:1.5px solid var(--ink);border-radius:var(--r-s);overflow:hidden;background:var(--paper-2)}
.srv-tros{display:block;height:100%;min-width:2px}
.srv-tros + .srv-tros{border-left:1.5px solid var(--ink)}
.srv-p-obert{background:var(--menta)}
.srv-p-menor{background:var(--presec)}
.srv-p-negociat{background:var(--lavanda)}
.srv-p-acord{background:var(--coral)}
.srv-p-altres{background:var(--ink-suau-tint)}
.srv-llegenda{list-style:none;padding:0;margin:var(--e2) 0;display:grid;gap:var(--e1);max-width:72ch}
.srv-llegenda li{display:grid;grid-template-columns:16px 1fr;gap:var(--e1);align-items:start}
.srv-mostra{width:16px;height:16px;border:1.5px solid var(--ink);border-radius:4px;margin-top:3px}
.srv-que{color:var(--ink-suau)}
.srv-tipus{padding-left:1.1rem;margin:0 0 var(--e2)}
.srv-municipi{margin-top:var(--e3)}
.srv-detall .srv-flux{margin-top:var(--e1)}
@media (max-width:480px){
  .srv-fila-barra{grid-template-columns:1fr}
  .srv-persones{min-width:9rem}
}
`;
