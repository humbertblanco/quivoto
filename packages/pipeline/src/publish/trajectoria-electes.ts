import { eq } from "drizzle-orm";
import { municipalities, municipalityMetrics, mayors, type Db } from "@quivoto/db";
import { dataCurta, normalizePersonName } from "../lib/text";
import { serieTemporal } from "./grafics";
import { RADIOGRAFIA_CSS } from "./estil";
import { MASCOTA_CSS, papereta } from "./mascota";
import { capcalera, tipografia } from "./capcalera";
import { adrecesRegidors } from "./regidor";
import { cercador } from "./cercador";
import { peu } from "./peu";
import { FAMILIES, KIND, type Familia, type FitxaTrajectoria } from "../jobs/j21-trajectoria-electes";
import { KIND as KIND_FOTOS, type FitxaFotosExalcaldes } from "../jobs/j28-fotos-exalcaldes";
import { FOTOS_WIKIMEDIA_CSS, creditRetrat, retratWikimedia, type Retrat } from "./fotos-wikidata";

/**
 * D'on surten els que manen: l'alcaldia com a primer esglaó.
 *
 * L'Observatori sabia dir qui mana a cada poble i des de quan. El que no sabia
 * dir és **cap on va aquesta gent després**, i és una pregunta que la gent es fa
 * de manera natural quan mira la fitxa del seu alcalde: això que fa ara, on el
 * porta? J21 ingereix la resposta de Wikidata i aquesta pàgina és el lloc on es
 * pot llegir sencera, perquè municipi a municipi no es veu: a 752 dels 947 no hi
 * ha ningú que hi hagi arribat, i a la resta n'hi ha un o dos.
 *
 * Les xifres de la darrera extracció (30-08-2026): **2.917 persones** amb
 * alcaldia catalana des del 1979 a Wikidata i **284** amb un càrrec per sobre
 * de l'ajuntament, sortides de **195 municipis** dels 947.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA REGLA DURA D'AQUESTA PÀGINA: LA COBERTURA VA SEMPRE AL COSTAT DE LA XIFRA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 284 de 2.917 vol dir que **de la resta no ho sabem**, no que no hi hagin
 * arribat. I aquí això no és una precaució de manual: és el risc principal de
 * la pàgina, perquè **Wikidata cobreix molt millor la gent famosa**. La prova,
 * mesurada sobre les mateixes dades que es publiquen:
 *
 *   · Dels 284 que han fet el salt, el **95,8 %** té article a la Viquipedia
 *     catalana.
 *   · Dels 2.633 que no consta que l'hagin fet, només el **12,9 %**.
 *
 * O sigui que la font no és un cens: és el que algú ha trobat prou notable per
 * escriure'n. Si aquesta pàgina digués «els alcaldes de ciutat gran fan més
 * carrera», estaria mesurant el biaix de la font i no la realitat. Per això
 * cada xifra hi va amb el seu denominador, el bloc de la cobertura és el segon
 * de la pàgina i no una nota al peu, i **no hi ha cap rànquing de municipis**:
 * l'ordre sortiria de qui té més article, no de qui fa més carrera.
 *
 * La dècada és el mateix cas al revés. Els que van estrenar alcaldia als anys
 * 2010 en fan el salt un 6,8 %, contra el 17,5 % dels que la van estrenar als
 * 80. No vol dir que ara les carreres siguin més curtes: vol dir que **encara
 * no han passat**. Està escrit al costat del gràfic.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Les formes: una graella de cent quadrats per a la proporció, sis barres per a
 * les sis menes de càrrec, un mapa de punts per al territori i la sèrie de
 * `grafics.ts` per a les dècades. Cap taula de text com a forma principal —les
 * que hi ha són les equivalents amagades que exigeix la regla 1 de `grafics.ts`.
 */

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const nombre = (n: number): string => n.toLocaleString("ca-ES");

/** Un tant per cent amb una xifra decimal, i sense decimal quan és rodó. */
export function percent(part: number, total: number): string {
  if (total <= 0) return "—";
  const p = (100 * part) / total;
  return `${p.toFixed(p >= 10 ? 0 : 1).replace(".", ",")} %`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les formes de la pàgina
// ─────────────────────────────────────────────────────────────────────────────

export type CarrecPagina = { nom: string; familia: Familia; inici: string | null; fi: string | null };

/** Una persona que ha fet el salt, ja ajuntada de tots els municipis on va manar. */
export type SaltPersona = {
  qid: string;
  url: string;
  nom: string;
  viquipedia: string | null;
  /** Els municipis on Wikidata li dona alcaldia, amb el nostre slug si el sabem. */
  municipis: { nom: string; slug: string | null }[];
  /** Any del primer mandat d'alcaldia: és l'ordre en què s'expliquen. */
  primerAny: number;
  ultimAny: number;
  families: Familia[];
  carrecs: CarrecPagina[];
  ocupacions: string[];
  /** Cert si el nom i les dates lliguen amb el nostre historial oficial. */
  aparellat: boolean;
  /**
   * On porta el seu nom. Sempre hi ha destí, i per això aquest camp no decideix
   * res a la plantilla: la fitxa de persona quan en té —només 333 dels 947
   * alcaldes, perquè les fitxes de regidor existeixen als 464 municipis amb
   * càrrecs al ple— i, quan no, l'historial d'alcaldies del seu municipi, que
   * hi és sempre. Un nom que no porta enlloc, en una pàgina de 283 noms, són
   * 283 preguntes que la pàgina obre i no respon.
   */
  fitxa: string | null;
  /** El retrat que publica el seu ajuntament, quan encara seu al ple. */
  foto: string | null;
  /**
   * El retrat de Wikimedia Commons que J28 ha baixat, quan és un exalcalde
   * amb fotografia lliure a Wikidata. Va darrere de l'oficial: la política de
   * fotografies el reserva per a quan no n'hi ha cap altre.
   */
  retrat: Retrat | null;
};

/**
 * El que ens cal de la fitxa de càrrecs de la seu electrònica: qui hi seu i
 * quin retrat en publica el seu ajuntament. La fitxa sencera la descriu
 * `radiografia.ts` i aquí no se'n toca res més.
 */
type CarrecDelPle = { nom: string; foto: string | null; fotoPetita: string | null };

export type MunicipiTrajectoria = {
  slug: string;
  nom: string;
  lat: number | null;
  lon: number | null;
  /** Alcaldes que Wikidata li coneix des del 1979. */
  alcaldes: number;
  /** Quants d'aquests han arribat més amunt. */
  ambSalt: number;
};

export type DecadaTrajectoria = { decada: number; alcaldes: number; ambSalt: number };

export type TrajectoriaData = {
  font: string;
  fontUrl: string;
  llicencia: string;
  /** Data d'extracció de Wikidata; `null` si cap fitxa no la porta. */
  descarregat: string | null;
  /** Persones diferents amb alcaldia catalana des del 1979 a Wikidata. */
  totalPersones: number;
  /** Les que lliguen amb el nostre historial oficial d'alcaldies. */
  aparellades: number;
  /**
   * Alcaldes diferents del **nostre** historial oficial. És el denominador de
   * debò: diu quina part del cens real cobreix Wikidata.
   */
  alcaldesHistorial: number;
  municipisAmbAlcalde: number;
  municipisTotal: number;
  ambSalt: number;
  families: { clau: Familia; etiqueta: string; frase: string; persones: number }[];
  decades: DecadaTrajectoria[];
  ocupacions: { nom: string; quants: number }[];
  ambOcupacio: number;
  /** Article a la Viquipedia catalana: la mesura del biaix de la font. */
  ambViquipedia: number;
  ambViquipediaSalt: number;
  ambViquipediaSenseSalt: number;
  municipis: MunicipiTrajectoria[];
  persones: SaltPersona[];
};

// ─────────────────────────────────────────────────────────────────────────────
// La graella de cent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cent quadrats, i els que toquen pintats. És la forma que respon «i això és
 * molt o poc?» sense demanar que ningú divideixi res de cap: 284 sobre 2.917
 * escrit en xifres no diu res, i deu quadrats pintats de cent sí.
 *
 * S'arrodoneix cap amunt quan hi ha alguna cosa i no arriba a un quadrat: una
 * graella tota buida diria «cap», que és fals. I mai no s'arrodoneix fins a
 * omplir-la del tot si en falta algun.
 */
export function graellaDeCent(part: number, total: number, etiqueta: string): string {
  if (total <= 0) return "";
  const bruts = (100 * part) / total;
  const plens = part === 0 ? 0 : Math.min(100, Math.max(1, Math.round(bruts)));
  const quadrats = Array.from({ length: 100 }, (_, i) => {
    const x = (i % 10) * 26;
    const y = Math.floor(i / 10) * 26;
    const ple = i < plens;
    return `<rect x="${x}" y="${y}" width="20" height="20" rx="4" class="${ple ? "ple" : "buit"}"/>`;
  }).join("");
  return `<figure class="cent">
  <svg viewBox="-2 -2 264 264" role="img" aria-label="${escape(etiqueta)}">${quadrats}</svg>
  <figcaption>${escape(etiqueta)}</figcaption>
</figure>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les sis menes de càrrec
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una barra per família, totes amb **la mateixa escala**, que és la regla 2 de
 * `grafics.ts`: 213 al Parlament i 3 al Parlament Europeu són dues coses molt
 * diferents i el dibuix ho ha de dir sense que calgui llegir el número.
 *
 * Les barres no sumen 284 i això s'escriu a sota: hi ha qui ha estat al
 * Parlament i després al Congrés, i comptar-lo un cop per lloc és el correcte.
 * Una suma de barres que no quadra amb el total i no s'explica és el que fa
 * desconfiar de tota la pàgina.
 */
export function barresFamilia(
  families: TrajectoriaData["families"],
  total: number,
): string {
  const amb = families.filter((f) => f.persones > 0).sort((a, b) => b.persones - a.persones);
  if (amb.length === 0) return "";
  const maxim = Math.max(...amb.map((f) => f.persones));
  const files = amb
    .map((f) => {
      const ample = Math.max(1.5, (100 * f.persones) / maxim);
      return `<li>
      <span class="quin">${escape(f.etiqueta)}</span>
      <span class="barra"><span style="width:${ample.toFixed(1)}%"></span></span>
      <span class="quants"><b>${nombre(f.persones)}</b> ${escape(percent(f.persones, total))}</span>
    </li>`;
    })
    .join("");
  return `<figure class="families">
  <ul>${files}</ul>
  <figcaption>Cada barra és quanta gent hi ha arribat, sobre les ${nombre(total)} persones
  que Wikidata dona com a alcaldes catalans des del 1979. <b>Les barres no sumen ${nombre(total)}</b>:
  qui ha estat al Parlament i després al Congrés compta a totes dues.</figcaption>
</figure>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// El mapa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Els municipis, un punt cadascun, i pintats només els que n'han donat algun.
 *
 * La projecció és la mateixa idea que fa servir el mapa de les comarques: cada
 * grau de longitud val menys com més amunt s'és, i sense corregir-ho Catalunya
 * surt estirada. La correcció es fa amb el cosinus de la latitud del centre.
 *
 * **Aquí no hi ha cap rànquing i el punt no creix amb el padró.** Un mapa amb
 * Barcelona com una taca i Alins com un punt diria «les ciutats grans en fan
 * més», que és exactament el que no podem dir amb aquesta font. La mida només
 * distingeix el zero de l'u i de més d'un.
 */
export function mapaOrigen(municipis: readonly MunicipiTrajectoria[]): string {
  const situats = municipis.filter(
    (m): m is MunicipiTrajectoria & { lat: number; lon: number } => m.lat !== null && m.lon !== null,
  );
  if (situats.length < 20) return "";

  const amplada = 680;
  const marge = 16;
  const lats = situats.map((m) => m.lat);
  const lons = situats.map((m) => m.lon);
  const latMax = Math.max(...lats);
  const latMin = Math.min(...lats);
  const lonMin = Math.min(...lons);
  const lonMax = Math.max(...lons);
  const cos = Math.cos((((latMax + latMin) / 2) * Math.PI) / 180);
  const ampleUtil = amplada - 2 * marge;
  const escala = ampleUtil / Math.max(1e-9, (lonMax - lonMin) * cos);
  const alcada = (latMax - latMin) * escala + 2 * marge;

  // Els que no n'han donat cap van primer perquè quedin a sota: si es pintessin
  // a sobre, taparien justament el que la pàgina vol ensenyar.
  const ordenats = [...situats].sort((a, b) => a.ambSalt - b.ambSalt);
  const punts = ordenats
    .map((m) => {
      const x = marge + (m.lon - lonMin) * cos * escala;
      const y = marge + (latMax - m.lat) * escala;
      const radi = m.ambSalt === 0 ? 2.4 : m.ambSalt === 1 ? 5 : 7.5;
      const classe = m.ambSalt === 0 ? "cap" : "algun";
      const qui =
        m.ambSalt === 0
          ? `${m.nom}: cap`
          : `${m.nom}: ${m.ambSalt === 1 ? "1 persona" : `${m.ambSalt} persones`}`;
      return `<a href="../m/${escape(m.slug)}/"><title>${escape(qui)}</title><circle class="${classe}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radi}"/></a>`;
    })
    .join("");

  const ambAlgun = situats.filter((m) => m.ambSalt > 0).length;
  return `<figure class="mapa-origen">
  <svg viewBox="0 0 ${amplada} ${alcada.toFixed(0)}" aria-label="Mapa de Catalunya amb un punt per municipi. ${ambAlgun} municipis dels ${situats.length} situats han donat com a mínim una persona que després ha ocupat un càrrec per sobre del seu ajuntament.">${punts}</svg>
  <figcaption><span class="clau"><i class="algun"></i> N'ha donat algun (${nombre(ambAlgun)})</span>
  <span class="clau"><i class="cap"></i> Cap que consti (${nombre(situats.length - ambAlgun)})</span>
  · El punt <b>no creix amb la població</b>: només distingeix cap, un i més d'un.
  Cada punt porta a la fitxa del municipi.</figcaption>
</figure>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les dècades
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La sèrie per dècada d'estrena a l'alcaldia, amb l'avís al costat.
 *
 * El pendent de baixada dels últims vint anys **no és una troballa**: qui va
 * estrenar alcaldia el 2015 encara té la carrera per fer. Dir-ho al costat del
 * dibuix, i no a la nota del final, és el que evita que la gent se'n vagi amb
 * la conclusió contrària.
 */
export function decades(files: readonly DecadaTrajectoria[]): string {
  const bones = files.filter((d) => d.alcaldes > 0);
  if (bones.length < 2) return "";
  const punts = bones.map((d) => ({ any: d.decada, valor: (100 * d.ambSalt) / d.alcaldes }));
  const grafic = serieTemporal(punts, {
    format: (v) => `${v.toFixed(1).replace(".", ",")} %`,
    titol: "Part dels alcaldes de cada dècada que després ocupen un càrrec superior",
    mida: "mitjana",
  });
  const llista = bones
    .map(
      (d) =>
        `<li><b>Anys ${d.decada}</b><span>${nombre(d.ambSalt)} de ${nombre(d.alcaldes)}</span></li>`,
    )
    .join("");
  return `${grafic}<ul class="decades">${llista}</ul>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Què feien abans
// ─────────────────────────────────────────────────────────────────────────────

export function ocupacions(
  files: readonly { nom: string; quants: number }[],
  ambOcupacio: number,
  total: number,
): string {
  const top = files.slice(0, 12);
  if (top.length === 0) return "";
  const maxim = Math.max(...top.map((o) => o.quants));
  const files2 = top
    .map(
      (o) => `<li>
      <span class="quin">${escape(o.nom)}</span>
      <span class="barra"><span style="width:${((100 * o.quants) / maxim).toFixed(1)}%"></span></span>
      <span class="quants"><b>${nombre(o.quants)}</b></span>
    </li>`,
    )
    .join("");
  return `<figure class="families ofici">
  <ul>${files2}</ul>
  <figcaption>Les dotze més freqüents de les ${nombre(ambOcupacio)} persones que en declaren
  alguna, de ${nombre(total)}. Una persona pot tenir-ne més d'una.
  <b>De les altres ${nombre(total - ambOcupacio)} no en sabem res</b>: no vol dir que no
  tinguessin ofici.</figcaption>
</figure>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Qui són
// ─────────────────────────────────────────────────────────────────────────────

const anyDe = (iso: string | null): string => (iso === null ? "" : iso.slice(0, 4));

/** Les dues primeres inicials, com a la resta de l'Observatori. */
export function inicials(nom: string): string {
  const lletres = nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return lletres || "?";
}

/**
 * El pas d'una persona: d'on venia i on va arribar.
 *
 * Les famílies van a un atribut de dades de la mateixa targeta perquè el filtre
 * de la llista no hagi de tornar a llegir el text: amagar una fitxa és canviar
 * `hidden`, i prou.
 */
export function fitxaPersona(p: SaltPersona): string {
  const on = p.municipis
    .map((m) =>
      m.slug === null
        ? escape(m.nom)
        : `<a href="../m/${escape(m.slug)}/">${escape(m.nom)}</a>`,
    )
    .join(", ");
  const carrecs = p.carrecs
    .map((c) => {
      const anys = c.inici === null ? "" : ` <span class="quan">${anyDe(c.inici)}${c.fi === null ? "–" : c.fi.slice(0, 4) === c.inici.slice(0, 4) ? "" : `–${c.fi.slice(0, 4)}`}</span>`;
      return `<li class="f-${c.familia}">${escape(c.nom)}${anys}</li>`;
    })
    .join("");
  /*
   * El nom porta a la nostra pàgina i no a Wikidata: qui llegeix «Josep
   * Pujadas» aquí es pregunta qui és, i la resposta la tenim nosaltres —el ple
   * on seu, què hi ha votat, què cobra. L'ítem de Wikidata i la Viquipedia són
   * la font i van al peu de la targeta, que és el seu lloc.
   */
  const nom =
    p.fitxa === null
      ? `<b>${escape(p.nom)}</b>`
      : `<b><a href="${escape(p.fitxa)}">${escape(p.nom)}</a></b>`;
  /*
   * La cara, per aquest ordre: el retrat oficial de l'ajuntament quan encara
   * seu al ple; si no, el de Wikimedia Commons que J28 ha baixat, amb el
   * crèdit al peu de la targeta; i si no hi ha cap dels dos, les inicials,
   * amb la mateixa mida i la mateixa vora. No és el forat que queda quan falta
   * una foto: és l'altra manera d'ensenyar una persona, la que ja fa servir la
   * resta de l'Observatori.
   */
  const retrat =
    p.foto !== null
      ? `<img class="retrat" src="${escape(p.foto)}" alt="" width="56" height="56" loading="lazy" decoding="async">`
      : p.retrat !== null
        ? retratWikimedia(p.retrat, 56)
        : `<span class="retrat inicials" aria-hidden="true">${escape(inicials(p.nom))}</span>`;
  // El crèdit va on la llicència el demana: a la vista, al peu de la mateixa
  // targeta que ensenya la cara, i mai darrere d'un «title».
  const credit = p.foto === null && p.retrat !== null ? ` · ${creditRetrat(p.retrat)}` : "";
  const anys =
    p.primerAny === 0 ? "" : p.ultimAny > p.primerAny ? `${p.primerAny}–${p.ultimAny}` : `${p.primerAny}`;
  return `<li class="persona" data-families="${escape(p.families.join(" "))}">
  <div class="cap">${retrat}
    <p class="qui">${nom}
    <span class="alcaldia">alcaldia a ${on}${anys === "" ? "" : ` · ${anys}`}</span></p></div>
  <ul class="carrecs">${carrecs}</ul>
  ${p.ocupacions.length === 0 ? "" : `<p class="ofici">Abans: ${escape(p.ocupacions.join(", "))}</p>`}
  <p class="origen"><a href="${escape(p.url)}" rel="noopener">${escape(p.qid)}</a>${
    p.viquipedia === null
      ? ""
      : ` · <a href="${escape(p.viquipedia)}" rel="noopener">Viquipedia</a>`
  }${p.aparellat ? "" : " · no lliga amb el nostre historial"}${credit}</p>
</li>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// L'estil
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Només el que és d'aquesta pàgina. Tot el que és comú —la capçalera, els
 * blocs, la tipografia, les taules amagades dels gràfics— surt de
 * `RADIOGRAFIA_CSS`, i les sis famílies fan servir els colors que ja hi ha
 * declarats en comptes d'inventar-ne cap de nou.
 */
export const TRAJECTORIA_CSS = `
.cent{margin:var(--e3) 0}
.cent svg{width:100%;max-width:340px;height:auto;display:block}
.cent .buit{fill:var(--vora)}
.cent .ple{fill:var(--coral);stroke:var(--ink);stroke-width:1.5}
.cent figcaption{font-size:.92rem;color:var(--ink-suau);margin-top:var(--e2);max-width:44ch}

.families{margin:var(--e3) 0}
.families ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.families li{display:grid;grid-template-columns:minmax(120px,11.5rem) minmax(0,1fr) auto;
  gap:var(--e2);align-items:center}
.families .quin{font-weight:700;font-size:.92rem;line-height:1.25}
.families .barra{height:20px;background:var(--vora);border-radius:var(--r-max);overflow:hidden}
.families .barra > span{display:block;height:100%;background:var(--coral);
  border-radius:var(--r-max);border:1.5px solid var(--ink)}
.families.ofici .barra > span{background:var(--lavanda)}
.families .quants{font-size:.8rem;color:var(--ink-suau);white-space:nowrap}
.families .quants b{font-family:var(--display);font-weight:900;font-size:1.25rem;color:var(--ink);
  margin-right:5px}
.families figcaption{font-size:.92rem;color:var(--ink-suau);margin-top:var(--e3);max-width:62ch}

.mapa-origen{margin:var(--e3) 0}
.mapa-origen svg{width:100%;height:auto;display:block}
.mapa-origen .cap{fill:var(--vora)}
.mapa-origen .algun{fill:var(--coral);stroke:var(--ink);stroke-width:1.5}
.mapa-origen a:hover .algun{fill:var(--presec)}
.mapa-origen figcaption{font-size:.92rem;color:var(--ink-suau);margin-top:var(--e2)}
.mapa-origen .clau{display:inline-flex;align-items:center;gap:6px;margin-right:var(--e2);
  font-weight:700;color:var(--ink)}
.mapa-origen .clau i{width:12px;height:12px;border-radius:var(--r-max);display:inline-block}
.mapa-origen .clau i.algun{background:var(--coral);border:1.5px solid var(--ink)}
.mapa-origen .clau i.cap{background:var(--vora)}

.decades{list-style:none;margin:var(--e2) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:var(--e2)}
.decades li{display:flex;flex-direction:column;gap:2px;font-size:.86rem;color:var(--ink-suau)}
.decades li b{font-family:var(--display);font-weight:900;font-size:.95rem;color:var(--ink)}

.gent{list-style:none;margin:var(--e3) 0 0;padding:0;display:grid;gap:var(--e2);
  grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.persona{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  padding:var(--e2);box-shadow:var(--ombra)}
.persona .cap{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px}
.persona .retrat{width:56px;height:56px;flex:0 0 auto;border-radius:var(--r-s);
  border:2px solid var(--ink);object-fit:cover;background:var(--paper-2)}
/* Les inicials de qui no té cap retrat: la mateixa mida i la mateixa vora,
   amb el lavanda de la casa a dins i no un gris esvaït. No hi ha partit a
   les targetes, i per això no porten el color de cap. */
.persona .retrat.inicials{--c:var(--lavanda);--t:var(--ink);font-size:1.1rem}
.persona .qui{margin:0;line-height:1.3}
.persona .qui b{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.02em}
.persona .qui a{color:inherit}
.persona .alcaldia{display:block;font-size:.84rem;color:var(--ink-suau);font-weight:700;margin-top:2px}
.persona .carrecs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.persona .carrecs li{font-size:.86rem;padding-left:14px;position:relative;line-height:1.35}
.persona .carrecs li::before{content:"";position:absolute;left:0;top:.45em;width:8px;height:8px;
  border-radius:2px;background:var(--coral);border:1.5px solid var(--ink)}
.persona .carrecs .f-govern::before{background:var(--lavanda)}
.persona .carrecs .f-diputacio::before{background:var(--menta)}
.persona .carrecs .f-europeu::before{background:var(--presec)}
.persona .quan{color:var(--ink-suau);font-size:.8rem;white-space:nowrap}
.persona .ofici{margin:10px 0 0;font-size:.84rem;color:var(--ink-suau)}
.persona .origen{margin:8px 0 0;font-size:.74rem;color:var(--ink-suau)}
.persona .origen a{color:inherit}

.filtra{display:flex;flex-wrap:wrap;gap:8px;margin:var(--e3) 0 0}
.filtra button{font:inherit;font-size:.84rem;font-weight:800;cursor:pointer;
  background:var(--paper-2);color:var(--ink);border:2px solid var(--ink);
  border-radius:var(--r-max);padding:7px 14px;min-height:38px}
.filtra button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
/* «.gent > li» d'estil.ts posa display:flex a cada targeta i, com que és una
   regla nostra, guanya al [hidden]{display:none} del navegador: el filtre
   canviava l'atribut i no s'amagava cap targeta. La caixa dels botons té el
   mateix problema al revés: neix amagada i el seu display:flex la ensenyava
   sense JavaScript. Les dues regles s'escriuen aquí perquè el [hidden] valgui. */
.gent > .persona[hidden],.filtra[hidden]{display:none}
.quants-gent{margin:var(--e2) 0 0;font-size:.86rem;color:var(--ink-suau);font-weight:700}
`;

// ─────────────────────────────────────────────────────────────────────────────
// La pàgina
// ─────────────────────────────────────────────────────────────────────────────

const FILTRE = `
<script>
(function(){
  // El filtre el posa el guió, com la casella de cerca: sense JavaScript no hi
  // ha cap botó que no faci res, i la llista surt sencera, que és el correcte.
  var caixa = document.querySelector(".filtra");
  var gent = document.querySelector(".gent");
  var quants = document.querySelector(".quants-gent");
  if (!caixa || !gent) return;
  caixa.hidden = false;
  var botons = caixa.querySelectorAll("button[data-familia]");
  var targetes = gent.querySelectorAll(".persona[data-families]");
  botons.forEach(function(b){
    b.addEventListener("click", function(){
      var clau = b.getAttribute("data-familia");
      var visibles = 0;
      botons.forEach(function(o){ o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
      targetes.forEach(function(li){
        // Famílies senceres i no un tros de text: «senat» no ha de trobar res
        // dins de cap altra clau, ara ni quan se n'afegeixi una.
        var families = (li.getAttribute("data-families") || "").split(" ");
        var amaga = clau !== "tots" && families.indexOf(clau) === -1;
        li.hidden = amaga;
        if (!amaga) visibles += 1;
      });
      if (quants) {
        quants.textContent = clau === "tots"
          ? "Es mostren les " + visibles + " persones."
          : "Es mostren " + visibles + " de " + targetes.length + " persones.";
      }
    });
  });
})();
</script>`;

/**
 * «al Parlament, al Congrés… o al Govern», escrit a partir de les famílies que
 * de debò tenen algú i no a mà: si un dia s'hi afegeix una mena de càrrec, la
 * frase d'entrada l'ha de recollir sola en comptes de quedar-se curta.
 */
export function llistaDestins(families: TrajectoriaData["families"]): string {
  const frases = families.filter((f) => f.persones > 0).map((f) => f.frase);
  if (frases.length === 0) return "";
  if (frases.length === 1) return frases[0]!;
  return `${frases.slice(0, -1).join(", ")} o ${frases[frases.length - 1]}`;
}

export function renderTrajectoriaElectes(data: TrajectoriaData, generatedAt: string): string {
  const title = "D'on surten els que manen — Observatori municipal de quivoto";
  const cobertura = `${nombre(data.ambSalt)} de ${nombre(data.totalPersones)}`;

  // La llista es llegeix del salt més antic al més recent i no per cap mesura
  // de rellevància: ordenar-la per «importància» del càrrec seria una opinió
  // nostra sobre què val més, i no és una cosa que sàpiga cap dada.
  const gent = [...data.persones].sort(
    (a, b) => b.primerAny - a.primerAny || a.nom.localeCompare(b.nom, "ca"),
  );
  // Els que ensenyen la cara de Commons: els que no tenen retrat oficial i sí
  // que en tenen un de lliure a Wikidata. La frase d'entrada ho diu amb xifra.
  const ambRetrat = gent.filter((p) => p.foto === null && p.retrat !== null).length;

  const botons = [
    `<button type="button" data-familia="tots" aria-pressed="true">Tots (${nombre(data.persones.length)})</button>`,
    ...data.families
      .filter((f) => f.persones > 0)
      .map(
        (f) =>
          `<button type="button" data-familia="${escape(f.clau)}" aria-pressed="false">${escape(f.etiqueta)} (${nombre(f.persones)})</button>`,
      ),
  ].join("");

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(title)}</title>
<meta name="description" content="Quants alcaldes catalans han arribat al Parlament, al Congrés, al Senat, a una diputació o al Govern: ${escape(cobertura)} dels que Wikidata coneix des del 1979, de quins municipis surten i què feien abans de la política.">
${tipografia("../")}
<style>${RADIOGRAFIA_CSS}${MASCOTA_CSS}${FOTOS_WIKIMEDIA_CSS}${TRAJECTORIA_CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>

${capcalera("../", "trajectoria")}
${cercador("../")}

<main id="contingut">

<section class="portada">
  <div class="presenta">${papereta(120, "pregunta")}<div>
    <p class="micro">Els que manen</p>
    <h1>D'on surten</h1>
  </div></div>
  <p class="entrada">L'alcaldia és, per a molta gent, el primer càrrec. Per a alguns
  també és l'últim, i per a d'altres el primer esglaó d'una escala que puja fins
  ${escape(llistaDestins(data.families))}.</p>
  <p class="resum"><b>${escape(cobertura)}</b> alcaldes catalans que Wikidata coneix des del 1979
  han ocupat després —o abans— un càrrec per sobre del seu ajuntament. Surten de
  ${nombre(data.municipis.filter((m) => m.ambSalt > 0).length)} municipis dels ${nombre(data.municipisTotal)}.</p>
  ${graellaDeCent(data.ambSalt, data.totalPersones, `De cada 100 alcaldes que Wikidata coneix, ${Math.max(1, Math.round((100 * data.ambSalt) / Math.max(1, data.totalPersones)))} han ocupat un càrrec per sobre del seu ajuntament.`)}
</section>

<nav class="index" aria-label="Seccions d'aquesta pàgina">
  <a href="#cobertura">Què no diu aquesta pàgina</a>
  <a href="#on">On arriben</a>
  <a href="#mapa">De quins pobles surten</a>
  <a href="#quan">Per dècades</a>
  <a href="#abans">Què feien abans</a>
  <a href="#gent">Qui són</a>
</nav>

<section class="bloc" id="cobertura">
  <h2>Què <em>no</em> diu aquesta pàgina</h2>
  <p class="entrada-bloc">És el bloc més important i per això va primer, abans de cap xifra.</p>
  <div class="destacat">
    <p><b>${escape(cobertura)}</b> vol dir que de les altres ${nombre(data.totalPersones - data.ambSalt)}
    <b>no ho sabem</b>, no que no hi hagin arribat mai.</p>
    <p>La font d'aquesta pàgina és Wikidata, i Wikidata <b>cobreix molt millor la gent famosa</b>:
    dels ${nombre(data.ambSalt)} que hi consta que han fet el salt, un
    ${escape(percent(data.ambViquipediaSalt, data.ambSalt))} té article a la Viquipedia catalana;
    dels ${nombre(data.totalPersones - data.ambSalt)} que no,
    només un ${escape(percent(data.ambViquipediaSenseSalt, data.totalPersones - data.ambSalt))}.
    No és un cens: és el que algú ha trobat prou notable per escriure'n.</p>
    <p>Per això aquí <b>no hi ha cap rànquing de municipis</b> i els punts del mapa no creixen
    amb la població. Una pàgina que digués «els alcaldes de ciutat gran fan més carrera»
    estaria mesurant el biaix de la font i no la realitat.</p>
  </div>
  <p class="nota">El nostre historial oficial d'alcaldies en porta ${nombre(data.alcaldesHistorial)}
  de diferents des del 1979; Wikidata en coneix ${nombre(data.totalPersones)}, i
  ${nombre(data.aparellades)} d'aquests lliguen amb el nostre pel nom i per les dates alhora.
  Els que no lliguen es publiquen igualment, dient que no lliguen: són dades de Wikidata i com a
  tals es marquen, però no s'enganxen a la fitxa de cap persona nostra. Un càrrec atribuït a qui
  no toca és pitjor que un buit.</p>
</section>

<section class="bloc" id="on">
  <h2>On arriben</h2>
  <p class="entrada-bloc">Sis menes de càrrec per sobre de l'ajuntament. La tinença d'alcaldia,
  la regidoria i el consell comarcal no hi són: són el mateix món local, no cap salt.</p>
  ${barresFamilia(data.families, data.totalPersones)}
</section>

<section class="bloc" id="mapa">
  <h2>De quins pobles surten</h2>
  <p class="entrada-bloc">${nombre(data.municipis.filter((m) => m.ambSalt > 0).length)} municipis
  dels ${nombre(data.municipisTotal)} han donat com a mínim una persona que després ha ocupat un
  càrrec per sobre del seu ajuntament.</p>
  ${mapaOrigen(data.municipis)}
</section>

<section class="bloc" id="quan">
  <h2>Per dècades</h2>
  <p class="entrada-bloc">Cada persona compta a la dècada en què va estrenar alcaldia.</p>
  ${decades(data.decades)}
  <p class="nota"><b>La baixada dels últims vint anys no vol dir que ara les carreres siguin
  més curtes</b>: vol dir que encara no han passat. Qui va estrenar alcaldia el 2015 té la
  carrera per fer, i el que aquest gràfic mesura d'aquella dècada és només el tros que ja s'ha
  esdevingut.</p>
</section>

<section class="bloc" id="abans">
  <h2>Què feien abans</h2>
  <p class="entrada-bloc">L'ocupació que Wikidata els atribueix, tret de «polític»,
  que no diu res de ningú.</p>
  ${ocupacions(data.ocupacions, data.ambOcupacio, data.totalPersones)}
</section>

<section class="bloc" id="gent">
  <h2>Qui són</h2>
  <p class="entrada-bloc">Els ${nombre(data.persones.length)}, del salt més recent al més antic.
  <b>El nom porta a la seva fitxa</b> quan encara seu al ple, i si no, a l'historial d'alcaldies
  del seu municipi. Cada targeta porta l'enllaç a l'ítem de Wikidata d'on surt.${
    ambRetrat === 0
      ? ""
      : ` La cara és el retrat que publica el seu ajuntament quan encara hi seu; ${nombre(ambRetrat)}
  porten un retrat de <b>Wikimedia Commons</b>, amb l'autor i la llicència al peu de la targeta;
  la resta, les inicials.`
  }</p>
  <div class="filtra" hidden>${botons}</div>
  <p class="quants-gent" aria-live="polite">Es mostren les ${nombre(data.persones.length)} persones.</p>
  <ul class="gent">${gent.map(fitxaPersona).join("")}</ul>
</section>

<section class="bloc" id="font">
  <h2>D'on surt tot això</h2>
  <p>${escape(data.font)}, consultat amb SPARQL a
  <a href="${escape(data.fontUrl)}" rel="noopener">${escape(data.fontUrl)}</a>${
    data.descarregat === null ? "" : ` el ${escape(dataCurta(data.descarregat))}`
  }. Les dades de Wikidata són <b>${escape(data.llicencia)}</b>. L'historial d'alcaldies amb què
  es contrasten és el de la Generalitat de Catalunya, que ja publica aquest Observatori.</p>
  <p class="nota">Es demanen les posicions «alcalde de…» amb àmbit d'aplicació a un municipi
  català i data d'inici a partir del 1979, i d'aquelles persones, tots els altres càrrecs amb
  la seva etiqueta en català. Els ítems duplicats —la mateixa persona amb dues fitxes— es
  fusionen en comptes de descartar-se. El detall de cada decisió és al capçal de la feina
  d'ingesta.</p>
</section>

</main>

${
  // El mapa ja és al peu de totes les pàgines; el que aquesta té de propi és
  // que la gent que hi surt és de partits, i els partits no són al peu.
  peu("../", generatedAt, [{ text: "Els partits", on: "../partit/" }])
}
${FILTRE}
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// La càrrega
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ajunta les 947 fitxes municipals de J21 en la vista de tot Catalunya.
 *
 * La mateixa persona és a la fitxa de cada municipi on va ser alcalde —n'hi ha
 * que en tenen dos— i per això aquí es dedupliquen **pel QID**: sense això, qui
 * va manar a dos pobles comptaria dues vegades i el total no quadraria amb el
 * que diu la feina d'ingesta.
 *
 * Torna `null` si J21 encara no s'ha executat, perquè una pàgina amb tots els
 * blocs a zero és pitjor que cap pàgina.
 */
export async function loadTrajectoriaElectes(db: Db): Promise<TrajectoriaData | null> {
  const files = await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      data: municipalityMetrics.data,
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, KIND));
  if (files.length === 0) return null;

  const munis = await db
    .select({
      id: municipalities.id,
      slug: municipalities.slug,
      name: municipalities.name,
      lat: municipalities.lat,
      lon: municipalities.lon,
    })
    .from(municipalities);
  const perId = new Map(munis.map((m) => [m.id, m]));

  /*
   * Qui seu avui a cada ple, per saber quins dels 283 tenen fitxa pròpia.
   *
   * Les fitxes de persona només existeixen als 464 municipis amb càrrecs
   * llegits de la seu electrònica, i dins d'aquests, només de qui hi seu ara:
   * un alcalde del 1983 no en té cap. L'adreça surt de `adrecesRegidors()`
   * sobre la mateixa llista i en el mateix ordre que fa servir el generador de
   * pàgines, que és l'única manera que l'enllaç i el directori no divergeixin
   * quan dues persones del mateix ple es diuen igual.
   */
  const plens = await db
    .select({
      municipalityId: municipalityMetrics.municipalityId,
      data: municipalityMetrics.data,
    })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, "carrecs"));
  const fitxesDelPle = new Map<number, Map<string, { adreca: string; foto: string | null }>>();
  for (const fila of plens) {
    const carrecs = (fila.data as { carrecs?: CarrecDelPle[] } | null)?.carrecs;
    if (!Array.isArray(carrecs)) continue;
    const adreces = adrecesRegidors(carrecs);
    const perNom = new Map<string, { adreca: string; foto: string | null }>();
    for (const carrec of carrecs) {
      const clau = normalizePersonName(carrec.nom);
      // Dos noms iguals al mateix ple: no se sap quin dels dos és, i penjar la
      // carrera de l'un a la fitxa de l'altre és el pitjor error possible en
      // una pàgina que porta el nom al títol. Es queda sense fitxa i va al
      // municipi, que sempre és cert.
      if (perNom.has(clau)) {
        perNom.set(clau, { adreca: "", foto: null });
        continue;
      }
      perNom.set(clau, {
        adreca: adreces.get(carrec)!,
        foto: carrec.fotoPetita ?? carrec.foto ?? null,
      });
    }
    fitxesDelPle.set(fila.municipalityId, perNom);
  }

  /*
   * Els retrats de Wikimedia Commons que J28 ha baixat dels exalcaldes, per
   * QID: qui ha manat a dos pobles és a les dues fitxes amb el mateix fitxer,
   * i amb un se'n té prou. Si J28 no s'ha executat no n'hi ha cap i les
   * targetes porten inicials, que és el correcte.
   */
  const retrats = new Map<string, Retrat>();
  const fotos = await db
    .select({ data: municipalityMetrics.data })
    .from(municipalityMetrics)
    .where(eq(municipalityMetrics.kind, KIND_FOTOS));
  for (const fila of fotos) {
    const llista = (fila.data as FitxaFotosExalcaldes | null)?.persones;
    if (!Array.isArray(llista)) continue;
    for (const p of llista) if (!retrats.has(p.qid)) retrats.set(p.qid, p);
  }

  const persones = new Map<string, SaltPersona>();
  const totsElsQid = new Set<string>();
  const perDecada = new Map<number, { alcaldes: number; ambSalt: number }>();
  const primerAnyPerQid = new Map<string, number>();
  const teSalt = new Set<string>();
  const teViquipedia = new Set<string>();
  const teOcupacio = new Set<string>();
  const aparellats = new Set<string>();
  const comptaOcupacio = new Map<string, Set<string>>();
  const perFamilia = new Map<Familia, Set<string>>(FAMILIES.map((f) => [f.clau, new Set()]));
  const municipisPagina: MunicipiTrajectoria[] = [];

  let font = "Wikidata (wikidata.org)";
  let fontUrl = "https://query.wikidata.org/sparql";
  let llicencia = "CC0 1.0";
  let descarregat: string | null = null;

  for (const fila of files) {
    const fitxa = fila.data as FitxaTrajectoria;
    const muni = perId.get(fila.municipalityId);
    if (!Array.isArray(fitxa?.persones) || muni === undefined) continue;
    font = fitxa.font ?? font;
    fontUrl = fitxa.url ?? fontUrl;
    llicencia = fitxa.llicenciaDades ?? llicencia;
    // La data d'extracció és la mateixa per a totes les fitxes d'una execució;
    // si per un reintent a mitges n'hi hagués dues, es publica la més recent,
    // que és la que descriu el que el lector està veient.
    if (fitxa.descarregat && (descarregat === null || fitxa.descarregat > descarregat)) {
      descarregat = fitxa.descarregat;
    }

    municipisPagina.push({
      slug: muni.slug,
      nom: muni.name,
      lat: muni.lat === null ? null : Number(muni.lat),
      lon: muni.lon === null ? null : Number(muni.lon),
      alcaldes: fitxa.persones.length,
      ambSalt: fitxa.persones.filter((p) => p.carrecs.length > 0).length,
    });

    for (const p of fitxa.persones) {
      totsElsQid.add(p.qid);
      if (p.viquipedia) teViquipedia.add(p.qid);
      if (p.aparellat) aparellats.add(p.qid);
      if (p.ocupacions.length > 0) teOcupacio.add(p.qid);
      for (const ofici of p.ocupacions) {
        const grup = comptaOcupacio.get(ofici);
        if (grup === undefined) comptaOcupacio.set(ofici, new Set([p.qid]));
        else grup.add(p.qid);
      }

      const anys = p.mandats.map((m) => Number(m.inici.slice(0, 4))).filter(Number.isFinite);
      const finals = p.mandats
        .map((m) => Number((m.fi ?? m.inici).slice(0, 4)))
        .filter(Number.isFinite);
      const primer = anys.length === 0 ? 0 : Math.min(...anys);
      if (primer > 0) {
        const previ = primerAnyPerQid.get(p.qid);
        // Qui ha manat a dos pobles compta a la dècada del primer dels dos.
        if (previ === undefined || primer < previ) primerAnyPerQid.set(p.qid, primer);
      }

      if (p.carrecs.length === 0) continue;
      teSalt.add(p.qid);
      for (const c of p.carrecs) perFamilia.get(c.familia)?.add(p.qid);

      const ja = persones.get(p.qid);
      const municipi = { nom: muni.name, slug: muni.slug };
      // On porta el seu nom des d'aquesta pàgina, que penja de /trajectoria/.
      const alPle = fitxesDelPle.get(fila.municipalityId)?.get(normalizePersonName(p.nom));
      const propia = alPle !== undefined && alPle.adreca !== "";
      const fitxa = propia
        ? `../m/${muni.slug}/regidor/${alPle!.adreca}/`
        : `../m/${muni.slug}/#alcaldies`;
      const foto = propia ? alPle!.foto : null;
      if (ja === undefined) {
        persones.set(p.qid, {
          qid: p.qid,
          url: p.url,
          nom: p.nom,
          viquipedia: p.viquipedia,
          municipis: [municipi],
          primerAny: primer,
          ultimAny: finals.length === 0 ? primer : Math.max(...finals),
          families: [...new Set(p.carrecs.map((c) => c.familia))],
          carrecs: p.carrecs.map((c) => ({
            nom: c.nom,
            familia: c.familia,
            inici: c.inici,
            fi: c.fi,
          })),
          ocupacions: p.ocupacions,
          aparellat: p.aparellat,
          fitxa,
          foto,
          retrat: retrats.get(p.qid) ?? null,
        });
      } else {
        // Segon municipi de la mateixa persona: s'hi afegeix el poble i
        // s'eixamplen els anys. Els càrrecs ja hi són, són els mateixos.
        if (!ja.municipis.some((m) => m.slug === municipi.slug)) ja.municipis.push(municipi);
        if (primer > 0 && (ja.primerAny === 0 || primer < ja.primerAny)) ja.primerAny = primer;
        if (finals.length > 0) ja.ultimAny = Math.max(ja.ultimAny, ...finals);
        ja.aparellat = ja.aparellat || p.aparellat;
        // Qui ha manat a dos pobles: mana la fitxa pròpia, si n'hi ha cap de
        // les dues. L'historial d'un municipi on ja no hi seu és el destí de
        // segona, i només s'hi va quan no n'hi ha cap de millor.
        if (propia && !ja.fitxa?.includes("/regidor/")) {
          ja.fitxa = fitxa;
          ja.foto = foto;
        }
      }
    }
  }

  for (const [qid, primer] of primerAnyPerQid) {
    const decada = Math.floor(primer / 10) * 10;
    const compte = perDecada.get(decada) ?? { alcaldes: 0, ambSalt: 0 };
    compte.alcaldes += 1;
    if (teSalt.has(qid)) compte.ambSalt += 1;
    perDecada.set(decada, compte);
  }

  /*
   * El denominador de debò. Wikidata en coneix 2.917; el nostre historial de la
   * Generalitat en porta molts més, i la diferència entre les dues xifres és
   * exactament el que el lector ha de poder veure per no confondre la cobertura
   * de la font amb la realitat.
   */
  const historial = await db
    .select({ municipalityId: mayors.municipalityId, name: mayors.name })
    .from(mayors);
  const alcaldesHistorial = new Set(
    historial.map((m) => `${m.municipalityId}|${normalizePersonName(m.name)}`),
  ).size;

  const totalPersones = totsElsQid.size;
  return {
    font,
    fontUrl,
    llicencia,
    descarregat,
    totalPersones,
    aparellades: aparellats.size,
    alcaldesHistorial,
    municipisAmbAlcalde: municipisPagina.filter((m) => m.alcaldes > 0).length,
    municipisTotal: munis.length,
    ambSalt: teSalt.size,
    families: FAMILIES.map((f) => ({
      clau: f.clau,
      etiqueta: f.etiqueta,
      frase: f.frase,
      persones: perFamilia.get(f.clau)?.size ?? 0,
    })),
    decades: [...perDecada.entries()]
      .map(([decada, v]) => ({ decada, ...v }))
      .sort((a, b) => a.decada - b.decada),
    ocupacions: [...comptaOcupacio.entries()]
      .map(([nom, qids]) => ({ nom, quants: qids.size }))
      .sort((a, b) => b.quants - a.quants || a.nom.localeCompare(b.nom, "ca")),
    ambOcupacio: teOcupacio.size,
    ambViquipedia: teViquipedia.size,
    ambViquipediaSalt: [...teSalt].filter((q) => teViquipedia.has(q)).length,
    ambViquipediaSenseSalt: [...totsElsQid].filter((q) => !teSalt.has(q) && teViquipedia.has(q))
      .length,
    municipis: municipisPagina,
    persones: [...persones.values()],
  };
}
