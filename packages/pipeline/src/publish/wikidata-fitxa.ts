import type { AgermanamentWikidata, FitxaCuriositatsWikidata, PersonaNascuda } from "../jobs/j33-municipi-wikidata";
import { dataCurta } from "../lib/text";
import { cara } from "./cara";
import { primers, type Curiositat, type FilaCuriositat } from "./curiositats";
import { creditsRetrats, type Retrat } from "./fotos-wikidata";

/**
 * Els dos blocs de la fitxa municipal que vénen de J33 —els agermanaments i
 * les persones nascudes al municipi segons Wikidata— i les dues curiositats
 * dels 947 que en surten.
 *
 * Són dades que cap font oficial no dona i que Wikidata sí que té, i per això
 * porten la marca «segons Wikidata» a la vista i la data de consulta al peu de
 * cada bloc, no en un `title`: qui llegeix ha de saber d'on surt cada nom
 * abans de creure-se'l, i Wikidata és col·laborativa. El que no hi és, no
 * s'escriu: un municipi sense agermanaments a Wikidata no té bloc, i no se'n
 * dedueix que no en tingui.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES CARES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La cara és la de `cara.ts` —la mateixa de l'alcaldia, més petita— amb la
 * miniatura de Commons que J33 ha comprovat que és lliure, o les inicials si
 * no n'hi ha. I porta el crèdit, com les cares de `fotos-wikidata.ts`:
 * plegat sota la llista, perquè una línia per persona mataria el bloc, però
 * amb l'autor, la llicència i l'enllaç al fitxer de cadascuna. Un `title` no
 * val: qui llegeix en un telèfon no el veu mai.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL CRITERI DE LA LLISTA ES DIU AMB TOTES LES LLETRES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * J33 desa les dotze persones amb més enllaços d'entrada de les que Wikidata
 * situa al municipi. No són «les més importants»: són les que tenen article a
 * més Wikipedies, i això afavoreix esportistes de competicions
 * internacionals. El bloc ho diu així i escriu la cobertura —«12 de les 560»—
 * al costat, que és la regla de les curiositats: la xifra de sobre quants
 * s'ha mirat és part del fet.
 */

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number): string => v.toLocaleString("ca-ES", { maximumFractionDigits: 0 });

// ─────────────────────────────────────────────────────────────────────────────
// El peu comú
// ─────────────────────────────────────────────────────────────────────────────

/**
 * «Segons Wikidata» i la data de consulta, al peu de cada bloc. L'enllaç va a
 * l'element del municipi, que és on qualsevol pot comprovar —i corregir— el
 * que el bloc diu.
 */
function peuWikidata(dades: FitxaCuriositatsWikidata, que: string): string {
  return `<p class="nota peu-wikidata">${que} <b>segons Wikidata</b> (dades ${escape(dades.llicenciaDades)}), consultat el ${escape(
    dataCurta(dades.consultat),
  )}. Es pot comprovar i completar a <a href="${escape(dades.url)}" rel="noopener nofollow">l'element ${escape(dades.qidMunicipi)}</a>.</p>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Els agermanaments
// ─────────────────────────────────────────────────────────────────────────────

/** «des del 1985», «1985-2020», o res: només la part de la data que Wikidata dona. */
export function periodeAgermanament(a: Pick<AgermanamentWikidata, "inici" | "fi">): string {
  const any = (iso: string | null): string | null => iso?.slice(0, 4) ?? null;
  const inici = any(a.inici);
  const fi = any(a.fi);
  if (inici !== null && fi !== null) return `${inici}-${fi}`;
  if (inici !== null) return `des del ${inici}`;
  if (fi !== null) return `fins al ${fi}`;
  return "";
}

/**
 * La llista d'agermanaments com a pastilles: el nom de la ciutat enllaçat al
 * seu element de Wikidata i el país en text. Cap bandera: la bandera d'una
 * ciutat és una imatge més que caldria acreditar, i el nom del país ja ho
 * diu. Cadena buida si no n'hi ha cap.
 */
export function renderAgermanaments(dades: FitxaCuriositatsWikidata | null | undefined): string {
  const llista = dades?.agermanaments ?? [];
  if (!dades || llista.length === 0) return "";
  const pastilles = llista
    .map((a) => {
      const periode = periodeAgermanament(a);
      return `<li class="agermanament${a.fi ? " acabat" : ""}"><a href="${escape(a.url)}" rel="noopener nofollow">${escape(a.nom)}</a>${
        a.pais ? `<span class="pais">${escape(a.pais)}</span>` : ""
      }${periode ? `<small>${escape(periode)}</small>` : ""}</li>`;
    })
    .join("\n    ");
  return `<section class="bloc" id="agermanaments">
  <h2>Agermanaments</h2>
  <p class="entrada-bloc">${llista.length === 1 ? "La ciutat amb què" : `Les ${n(llista.length)} ciutats amb què`} el municipi consta agermanat, amb l'any que Wikidata en dona quan en dona.</p>
  <ul class="agermanaments">
    ${pastilles}
  </ul>
  ${peuWikidata(dades, "Agermanaments (P190)")}
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les persones nascudes al municipi
// ─────────────────────────────────────────────────────────────────────────────

/** «1990», «1881-1973», o res. Només l'any: Wikidata sovint no en sap més, i el bloc no ho ha de fer semblar. */
export function anysDeVida(p: Pick<PersonaNascuda, "naixement" | "defuncio">): string {
  const naixement = p.naixement?.slice(0, 4) ?? null;
  const defuncio = p.defuncio?.slice(0, 4) ?? null;
  if (naixement !== null && defuncio !== null) return `${naixement}-${defuncio}`;
  if (naixement !== null) return naixement;
  if (defuncio !== null) return `† ${defuncio}`;
  return "";
}

/** La fotografia d'una persona en la forma que `fotos-wikidata.ts` sap acreditar. */
export function retratDe(p: PersonaNascuda): Retrat | null {
  if (p.imatge === null) return null;
  return {
    nom: p.nom,
    cami: p.imatge.miniaturaUrl,
    fitxer: p.imatge.fitxer,
    paginaFitxer: p.imatge.paginaFitxer,
    autor: p.imatge.autor,
    llicencia: { nom: p.imatge.llicencia.nom, url: p.imatge.llicencia.url },
  };
}

function personaHtml(p: PersonaNascuda): string {
  const nom = p.viquipedia
    ? `<a href="${escape(p.viquipedia)}" rel="noopener nofollow">${escape(p.nom)}</a>`
    : `<span class="sense-article">${escape(p.nom)}</span>`;
  const anys = anysDeVida(p);
  const detall = [anys ? `<span class="anys">${escape(anys)}</span>` : "", p.ocupacio ? escape(p.ocupacio) : ""]
    .filter(Boolean)
    .join(" · ");
  // L'element de Wikidata sempre s'enllaça: és la font, i per a qui no té
  // article a la Viquipèdia és l'únic lloc on comprovar el que es diu.
  return `<li>${cara(p.nom, p.imatge?.miniaturaUrl ?? null, { mida: 44 })}<span class="qui"><b>${nom}</b>${
    detall ? `<small>${detall}</small>` : ""
  }<small><a class="wd" href="${escape(p.url)}" rel="noopener nofollow">${escape(p.qid)} a Wikidata</a></small></span></li>`;
}

/**
 * Les persones nascudes al municipi, amb cara o inicials, els anys de vida i
 * l'ocupació. La cobertura va al davant —«les 12 amb més enllaços de les 560
 * que Wikidata hi situa»— i els crèdits de les fotografies, plegats a sota.
 * Cadena buida si Wikidata no hi situa ningú.
 */
export function renderNascuts(dades: FitxaCuriositatsWikidata | null | undefined): string {
  const persones = dades?.nascuts?.persones ?? [];
  const total = dades?.nascuts?.total ?? 0;
  if (!dades || persones.length === 0 || total === 0) return "";
  const retallat = total > persones.length;
  const entrada = retallat
    ? `Wikidata hi situa <b>${n(total)} persones</b> nascudes. Aquestes són les ${n(persones.length)} amb més enllaços
  d'entrada —les que tenen article a més edicions de la Wikipedia—, que no vol dir les més importants: el criteri
  afavoreix qui ha competit o publicat fora.`
    : `Wikidata hi situa <b>${total === 1 ? "una persona nascuda" : `${n(total)} persones nascudes`}</b>${total === 1 ? "" : ", i són aquestes"}.`;
  const retrats = persones.flatMap((p) => {
    const r = retratDe(p);
    return r === null ? [] : [r];
  });
  return `<section class="bloc" id="nascuts">
  <h2>Persones nascudes al municipi</h2>
  <p class="entrada-bloc">${entrada}</p>
  <ul class="nascuts">
    ${persones.map(personaHtml).join("\n    ")}
  </ul>
  ${creditsRetrats(retrats)}
  ${peuWikidata(dades, `Lloc de naixement (P19)${retallat ? `, ${n(persones.length)} de ${n(total)}` : ""}`)}
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les curiositats dels 947
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El que aquestes dues curiositats necessiten de cada fila dels 947, a més
 * del que ja porta `FilaCuriositat`: quants agermanaments i quantes persones
 * nascudes al municipi té a Wikidata. Opcionals pel mateix motiu que la resta
 * de camps de la fila: «no hi és» i `null` volen dir el mateix.
 */
export type FilaCuriositatWikidata = FilaCuriositat & {
  /** agermanaments a Wikidata */
  ag?: number | null;
  /** persones que Wikidata situa nascudes al municipi (el total, no les 12 desades) */
  nas?: number | null;
};

const municipi = (f: FilaCuriositat): { s: string; n: string; c: string } => ({ s: f.s, n: f.n, c: f.c });

const teNombre = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Les dues curiositats de Wikidata, al format de `curiositats.ts`: els
 * municipis amb més agermanaments i els que tenen més persones amb fitxa.
 * Cadascuna diu sobre quants municipis s'ha mirat i, la segona, quantes
 * persones situa Wikidata en total, que és la cobertura de debò.
 */
export function curiositatsWikidata(files: readonly FilaCuriositatWikidata[]): Curiositat[] {
  const total = files.length;
  const fets: Curiositat[] = [];
  const font = "Wikidata (CC0)";
  const sobre = (quants: number, que: string): string =>
    `S'ha mirat ${que} de ${n(quants)} municipis${quants < total ? ` dels ${n(total)}` : ""}.`;

  // ---- els municipis amb més agermanaments -------------------------------
  {
    const ambDada = files.filter((f) => teNombre(f.ag));
    const ambAlgun = ambDada.filter((f) => f.ag! > 0);
    if (ambAlgun.length > 0) {
      const { files: mes, empatats } = primers(ambAlgun, (f) => f.ag!, (f) => f.n, 10, "max");
      fets.push({
        id: "agermanaments",
        titol: "Els municipis amb més agermanaments",
        metode: "Quantes ciutats consten agermanades amb el municipi al seu element de Wikidata (P190), comptant també els agermanaments acabats.",
        periode: "foto de la darrera consulta",
        font,
        llistes: [{
          cap: "Els que en tenen més",
          files: mes.map((f) => ({
            municipi: municipi(f),
            valor: f.ag === 1 ? "1 agermanament" : `${n(f.ag!)} agermanaments`,
          })),
          empatats,
        }],
        cobertura: `${sobre(ambDada.length, "l'element de Wikidata")} En tenen algun ${n(ambAlgun.length)}.`,
        cautela: "Wikidata en té els que algú hi ha escrit: un municipi sense cap agermanament a la llista pot tenir-ne.",
      });
    }
  }

  // ---- els municipis amb més persones amb fitxa a Wikidata ----------------
  {
    const ambDada = files.filter((f) => teNombre(f.nas));
    const ambAlgu = ambDada.filter((f) => f.nas! > 0);
    if (ambAlgu.length > 0) {
      const persones = ambDada.reduce((suma, f) => suma + f.nas!, 0);
      const { files: mes, empatats } = primers(ambAlgu, (f) => f.nas!, (f) => f.n, 10, "max");
      fets.push({
        id: "nascuts-wikidata",
        titol: "Els municipis on han nascut més persones amb fitxa a Wikidata",
        metode: "Quantes persones tenen el municipi com a lloc de naixement (P19) a Wikidata. Compta fitxes, no naixements: hi ha qui té fitxa perquè va jugar a segona divisió i qui no en té havent fet molt més.",
        periode: "foto de la darrera consulta",
        font,
        llistes: [{
          cap: "Els que en tenen més",
          files: mes.map((f) => ({
            municipi: municipi(f),
            valor: f.nas === 1 ? "1 persona" : `${n(f.nas!)} persones`,
            detall: f.p > 0 ? `${n(f.p)} habitants` : undefined,
          })),
          empatats,
        }],
        cobertura: `${sobre(ambDada.length, "el lloc de naixement a Wikidata")} En total, Wikidata hi situa ${n(persones)} persones, de les ${n(ambAlgu.length)} municipis on n'hi situa alguna.`,
        cautela: "Les ciutats grans en tenen més perquè hi neix més gent, no perquè en surti gent més notable. La fitxa de cada municipi ensenya les dotze amb més enllaços d'entrada.",
      });
    }
  }

  return fets;
}

// ─────────────────────────────────────────────────────────────────────────────
// L'estil
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Només el que és d'aquests dos blocs: les pastilles dels agermanaments, amb
 * el mateix llenguatge que les etiquetes de la casa, i la llista de persones
 * amb la cara a l'esquerra. La cara i el crèdit ja tenen el seu CSS
 * (`estil.ts` i `FOTOS_WIKIMEDIA_CSS`).
 */
export const WIKIDATA_FITXA_CSS = `
.agermanaments{list-style:none;margin:var(--e2) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.agermanament{display:inline-flex;align-items:baseline;gap:6px;border:2px solid var(--ink);border-radius:var(--r-max);
  padding:6px 14px;background:var(--paper-2);font-weight:800;font-size:.92rem}
.agermanament a{color:var(--ink)}
.agermanament .pais{font-weight:600;color:var(--ink-suau)}
.agermanament small{font-size:.74rem;font-weight:700;color:var(--ink-suau)}
.agermanament.acabat{border-style:dashed}
.nascuts{list-style:none;margin:var(--e2) 0 0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.nascuts li{display:flex;align-items:center;gap:12px;border:2px solid var(--vora);border-radius:var(--r-m);padding:9px 12px;background:var(--paper);min-width:0}
.nascuts li:hover{border-color:var(--ink)}
.nascuts .qui{display:flex;flex-direction:column;gap:2px;min-width:0}
.nascuts .qui b a{color:var(--ink)}
.nascuts .qui small{color:var(--ink-suau);font-size:.78rem;overflow-wrap:anywhere}
.nascuts .qui .anys{font-variant-numeric:tabular-nums}
.nascuts .qui .wd{color:inherit;text-decoration-color:var(--vora)}
.nascuts .qui .wd:hover{color:var(--coral-text)}
.peu-wikidata b{color:var(--ink)}
@media(max-width:640px){.nascuts{grid-template-columns:1fr}}
`;
