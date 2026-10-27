import { capcalera, tipografia } from "./capcalera";
import { cercador } from "./cercador";
import { SITE } from "./config";
import { RADIOGRAFIA_CSS } from "./estil";
import { atributsEtiqueta, GRAFICS_JS, textEtiqueta } from "./grafics";
import { peu } from "./peu";
import { ARREL_OBSERVATORI, capSeo, filAriadna, FITXER_OG, imatgeOg } from "./seo";
import { consultatEl, de, nomLlegible as nomLlegibleComu, normalize, slugify } from "../lib/text";
import { adrecaEns, type DadesEns, type FontEns, type MembreEns } from "./ens-tipus";
import { ultimaDespesa } from "./ens-dades";

/**
 * L'índex dels ens supramunicipals: les diputacions i els consells comarcals
 * en una sola pàgina, `observatori/ens/`.
 *
 * ## Per què una pàgina d'entrada i no només 44 fitxes
 *
 * Qui arriba aquí no sap, gairebé mai, què és una diputació. Sap on viu. Per
 * això la pàgina fa tres coses, en aquest ordre:
 *
 *   1. **Explica les capes.** El teu poble és dins d'una comarca i d'una
 *      província, i cada una té un ple que ningú no vota directament: hi
 *      seuen regidors. El dibuix de capes que s'encaixen és l'element que s'ha
 *      d'emportar el lector, i per això va a dalt, abans de cap taula.
 *   2. **Respon «i el meu?».** Un cercador petit diu, per a un municipi, quin
 *      consell i quina diputació li toquen. És millora progressiva: sense
 *      JavaScript no surt, i la llista del punt 3 ja diu el mateix.
 *   3. **Ho posa tot en una llista.** Les diputacions, cada una amb els seus
 *      consells a sota: qui el presideix, quants seients té, quant gasta per
 *      habitant i com és el ple, en una barra fina amb els colors de dada.
 *
 * ## Com se sap quin consell i quina diputació toquen a cada municipi
 *
 * No hi ha cap taula que ho digui directament: es dedueix. El consell és el de
 * la comarca del municipi (pel nom de la comarca, sense l'article: «el Bages» i
 * «Bages» són la mateixa) i la diputació, la de la seva província. Es fa aquí i
 * no a `ens.ts` perquè aquell fitxer el fa un altre carril i aquest índex no
 * en pot dependre.
 *
 * Un consell va sota la diputació de la província del municipi on té la seu.
 * Hi ha comarques que travessen la ratlla de província (la Cerdanya, la Selva,
 * Osona…): aquestes ho diuen a la seva fila, perquè als seus municipis no els
 * toca a tots la mateixa diputació.
 *
 * ## El que no hi ha
 *
 * Tres comarques no tenen consell i una àrea en té un altre per sobre: el
 * Barcelonès (dissolt el 2019), el Lluçanès (comarca des del 2023, sense
 * consell fins després de les municipals del 2027), l'Aran (hi ha el Conselh
 * Generau, que es vota directament) i l'AMB. Van en un bloc propi i el
 * cercador també les explica, perquè un forat sense explicació sembla un error.
 */

/** El mínim que l'índex fa servir de cada municipi. */
export type MunicipiIndex = {
  slug: string;
  nom: string;
  comarca: string | null;
  provincia: string | null;
};

/** Les tres comarques que no tenen consell comarcal ordinari. */
export type Excepcio = "barcelones" | "llucanes" | "aran";

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const number = (n: number): string => n.toLocaleString("ca-ES");

/**
 * La clau per aparellar noms de territori: sense accents, sense majúscules i
 * sense l'article del davant. «l'Alt Empordà» i «Alt Empordà» donen el mateix;
 * «Val d'Aran» i «Aran» també, perquè les fonts fan servir tots dos noms.
 */
export function clauTerritori(nom: string): string {
  const net = normalize(nom).replace(/^(l|el|la|els|les)\s+/, "");
  return net === "val d aran" ? "aran" : net;
}

/** Quina de les tres excepcions és una comarca, si n'és alguna. */
export function excepcioDe(comarca: string | null): Excepcio | null {
  if (!comarca) return null;
  const clau = clauTerritori(comarca);
  if (clau === "barcelones") return "barcelones";
  if (clau === "llucanes") return "llucanes";
  if (clau === "aran") return "aran";
  return null;
}

/**
 * Les dues taules de busca: consell per comarca i diputació per província.
 * Un consell s'hi apunta pel seu territori i, si és diferent, pel nom de la
 * comarca germana, que és el que fan servir les altres pàgines.
 */
export function taulesDeBusca(llista: readonly DadesEns[]): {
  consells: Map<string, DadesEns>;
  diputacions: Map<string, DadesEns>;
} {
  const consells = new Map<string, DadesEns>();
  const diputacions = new Map<string, DadesEns>();
  for (const e of llista) {
    if (e.tipus === "diputacio") diputacions.set(clauTerritori(e.territori), e);
    else {
      consells.set(clauTerritori(e.territori), e);
      if (e.comarca) consells.set(clauTerritori(e.comarca.nom), e);
    }
  }
  return { consells, diputacions };
}

/**
 * El consell i la diputació d'un municipi. `null` a cada banda quan no se'n
 * troba: el cercador ho diu així i no s'inventa cap ens.
 */
export function ensDelMunicipi(
  m: MunicipiIndex,
  taules: ReturnType<typeof taulesDeBusca>,
): { consell: DadesEns | null; diputacio: DadesEns | null } {
  return {
    consell: m.comarca ? taules.consells.get(clauTerritori(m.comarca)) ?? null : null,
    diputacio: m.provincia ? taules.diputacions.get(clauTerritori(m.provincia)) ?? null : null,
  };
}

/**
 * Les partícules que algunes fonts ja escriuen en minúscula enmig d'un nom
 * que, per la resta, va tot en majúscules.
 */
const PARTICULES_MINUSCULES = new Set(["i", "y", "de", "del", "dels", "la", "les", "el", "els", "d", "l"]);

/**
 * El nom d'una persona en lletra normal quan la font l'escriu en majúscules.
 *
 * La feina la fa `nomLlegible()` de `lib/text.ts`, la mateixa de la resta de
 * l'Observatori, perquè un nom s'ha d'escriure igual a la fitxa del poble, a la
 * de la persona i aquí. Però aquella funció no toca cap nom que ja porti alguna
 * minúscula —vol dir que algú l'ha escrit bé—, i el registre de plens en té un
 * cas propi: la conjunció i les partícules en minúscula enmig d'un nom que per
 * la resta crida, «NOEMÍ TRUCHARTE i CERVERA», «JOAN d'ARQUER». Amb aquella
 * «i» la funció comuna el donava per bo i sortia tal qual a la taula.
 *
 * Per això aquí es decideix sense les partícules (ni el que va entre
 * parèntesis, com «(Ind.)»): si el que queda és tot majúscules, el nom es
 * passa sencer a majúscules i la funció comuna el torna a escriure bé. Un nom
 * que ja barreja majúscules i minúscules («Eloi Hernàndez i Mosella») no es
 * toca.
 */
export function nomLlegible(nom: string): string {
  const net = nom.trim().replace(/\s+/g, " ");
  const decisiu = net
    .replace(/\([^)]*\)/g, " ")
    .split(" ")
    .map((mot) => mot.replace(/^[dl]['’]/i, ""))
    .filter((mot) => mot !== "" && !PARTICULES_MINUSCULES.has(mot))
    .join(" ");
  const crida = /\p{Lu}/u.test(decisiu) && !/\p{Ll}/u.test(decisiu);
  // El que va entre parèntesis és una abreviatura («(Ind.)») i es deixa tal
  // com ve: la funció comuna l'abaixaria a «(ind.)». La resta del nom, si
  // crida, es passa sencera a majúscules perquè la funció comuna la reescrigui.
  return net
    .split(/(\s*\([^)]*\)\s*)/)
    .map((tros, i) => {
      if (i % 2 === 1 || tros.trim() === "") return tros;
      return nomLlegibleComu(crida ? tros.toLocaleUpperCase("ca") : tros);
    })
    .join("");
}

/** Una diputació amb els consells que pengen de la seva província. */
export type GrupDemarcacio = {
  diputacio: DadesEns | null;
  consells: { ens: DadesEns; altresProvincies: string[] }[];
};

/** L'ordre dels noms de territori, sense l'article: «l'Alt Camp» va a la A. */
const perTerritori = (a: DadesEns, b: DadesEns): number =>
  clauTerritori(a.territori).localeCompare(clauTerritori(b.territori), "ca");

/**
 * Les diputacions amb els seus consells a sota.
 *
 * Un consell va a la província del municipi on té la seu; si no se sap la seu,
 * a la província de la majoria dels municipis de la comarca. Si tampoc, va a un
 * grup final sense diputació, que la pàgina diu tal com és. `altresProvincies`
 * són les altres províncies on la comarca té municipis: a aquells veïns els
 * toca una altra diputació, i la fila ho ha de dir.
 *
 * L'ordre és alfabètic, a tots dos nivells. No hi ha cap ordre «de millor a
 * pitjor» possible entre ens que fan feines diferents, i l'alfabet no en
 * suggereix cap.
 */
export function agrupaPerDemarcacio(
  llista: readonly DadesEns[],
  municipis: readonly MunicipiIndex[],
): GrupDemarcacio[] {
  const taules = taulesDeBusca(llista);
  const provinciaDe = new Map(municipis.map((m) => [m.slug, m.provincia]));
  const grups = new Map<DadesEns | null, GrupDemarcacio>();
  const diputacions = llista.filter((e) => e.tipus === "diputacio").sort(perTerritori);
  for (const d of diputacions) grups.set(d, { diputacio: d, consells: [] });

  for (const c of llista.filter((e) => e.tipus === "consell").sort(perTerritori)) {
    const claus = new Set([clauTerritori(c.territori), ...(c.comarca ? [clauTerritori(c.comarca.nom)] : [])]);
    // Quants municipis de la comarca té cada província.
    const recompte = new Map<string, number>();
    for (const m of municipis) {
      if (!m.comarca || !m.provincia || !claus.has(clauTerritori(m.comarca))) continue;
      recompte.set(m.provincia, (recompte.get(m.provincia) ?? 0) + 1);
    }
    const majoria = [...recompte.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ca"))[0]?.[0];
    const provincia = (c.seu ? provinciaDe.get(c.seu.slug) : null) ?? majoria ?? null;
    const diputacio = provincia ? taules.diputacions.get(clauTerritori(provincia)) ?? null : null;
    const altresProvincies = [...recompte.keys()]
      .filter((p) => !provincia || clauTerritori(p) !== clauTerritori(provincia))
      .sort((a, b) => a.localeCompare(b, "ca"));
    let grup = grups.get(diputacio);
    if (!grup) {
      grup = { diputacio, consells: [] };
      grups.set(diputacio, grup);
    }
    grup.consells.push({ ens: c, altresProvincies });
  }
  // El grup sense diputació, si n'hi ha, al final.
  return [...grups.values()].sort((a, b) => (a.diputacio ? 0 : 1) - (b.diputacio ? 0 : 1));
}

/**
 * El que diu el cercador quan el municipi és d'una comarca sense consell. Són
 * els mateixos fets que el bloc d'excepcions de la pàgina, dits per a un sol
 * veí. Van dins de les dades i no escrits al script perquè així el text passa
 * per `JSON.stringify` i el script no ha d'escapar cap apòstrof.
 *
 * El Lluçanès no té consell propi, però els seus regidors no han quedat fora
 * de tot: els que van sortir de les municipals del 2023 seuen al Consell
 * Comarcal d'Osona fins al 2027, i és el que diuen també les fitxes de cada
 * poble. Si el consell d'Osona és a la llista, el text hi porta; si no, no
 * s'enllaça cap adreça que podria no existir.
 */
export function textosExcepcio(
  base: string,
  llista: readonly DadesEns[] = [],
): Record<Excepcio, { t: string; n: string | null; u: string | null }> {
  const osona = llista.find((e) => e.tipus === "consell" && clauTerritori(e.territori) === "osona") ?? null;
  return {
    barcelones: {
      t:
        "El Barcelonès no té consell comarcal des del 2019, quan el va dissoldre la Llei 1/2019. " +
        "Els seus cinc municipis són a l'Àrea Metropolitana de Barcelona.",
      n: "L'Àrea Metropolitana de Barcelona",
      u: `${base}amb/`,
    },
    llucanes: {
      t:
        "El Lluçanès és comarca des del 2023, però encara no té consell comarcal propi: el primer sortirà " +
        "de les municipals del maig del 2027. Fins llavors, els seus regidors del 2023 són al " +
        (osona ? "consell d'Osona:" : "Consell Comarcal d'Osona."),
      n: osona ? osona.nom : null,
      u: osona ? `${base}${adrecaEns(osona.tipus, osona.slug)}` : null,
    },
    aran: {
      t:
        "A l'Aran no hi ha consell comarcal: hi ha el Conselh Generau d'Aran, que els veïns voten " +
        "directament, el mateix dia que les municipals.",
      n: "conselharan.org",
      u: "https://www.conselharan.org/",
    },
  };
}

/**
 * Les dades del cercador «el teu poble», ja a punt per anar dins d'un
 * `<script type="application/json">`.
 *
 * Són arrays curts i no objectes perquè n'hi ha 947: `m` és
 * `[etiqueta, slug, comarca, consell, diputacio, excepcio]`, on consell i
 * diputacio són posicions dins d'`e` (o -1). L'etiqueta és el nom, amb la
 * comarca al darrere només si dos municipis es diuen igual. Les adreces ja hi
 * van relatives a la pàgina, i el script només les copia a un `href`.
 */
export function dadesCercador(
  llista: readonly DadesEns[],
  municipis: readonly MunicipiIndex[],
  base: string,
): string {
  const taules = taulesDeBusca(llista);
  const ens = [...llista];
  const posicio = new Map(ens.map((e, i) => [e, i]));
  const vegades = new Map<string, number>();
  for (const m of municipis) vegades.set(m.nom, (vegades.get(m.nom) ?? 0) + 1);
  const files = [...municipis]
    .sort((a, b) => a.nom.localeCompare(b.nom, "ca"))
    .map((m) => {
      const { consell, diputacio } = ensDelMunicipi(m, taules);
      const etiqueta = (vegades.get(m.nom) ?? 0) > 1 && m.comarca ? `${m.nom} (${m.comarca})` : m.nom;
      return [
        etiqueta,
        m.slug,
        m.comarca ?? "",
        consell ? posicio.get(consell) ?? -1 : -1,
        diputacio ? posicio.get(diputacio) ?? -1 : -1,
        excepcioDe(m.comarca) ?? "",
      ];
    });
  const dades = {
    base,
    e: ens.map((e) => ({ n: e.nom, u: `${base}${adrecaEns(e.tipus, e.slug)}` })),
    m: files,
    x: textosExcepcio(base, llista),
  };
  // `<` es torna `<`: cap nom amb «</script>» no pot tancar l'etiqueta.
  // I els dos separadors de línia d'Unicode, que JSON admet i JavaScript antic no.
  return JSON.stringify(dades)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Els estils propis de l'índex, tots amb el prefix `ensi-`.
 *
 * Les capes del dibuix porten els fons de marca (presec, lavanda, menta), que
 * no canvien en mode fosc; per això hi va la tinta fosca escrita a mà
 * (`#1E1B2E`) i no `var(--ink)`, que en fosc es torna clara i desapareixeria
 * damunt d'un fons clar. Mateixa solució que la resta del web per a les
 * pastilles que es queden clares.
 *
 * L'escala de lletra és fixa i no baixa d'aquí: el cos de la pàgina és el de
 * tot el web (17px), les taules van a 15px, i les línies de context (de quin
 * any és la xifra, de quin ple ve la persona, la llegenda de la barra) a 13,6px.
 * Les primeres versions baixaven fins a 11-12px i, en una pàgina que vol
 * llegir qui no sap què és una diputació, la lletra petita era la que deia
 * més coses. Les xifres van amb números tabulars perquè s'alineïn en columna.
 *
 * Els espais són els tokens de sempre (`--e1`…`--e5`): entre blocs, el `.bloc`
 * comú; entre províncies, `--e5`; dins d'una capa, `--e2`.
 *
 * La portada s'ha d'acabar abans que la pantalla: a 1280×800 s'hi ha de veure
 * el dibuix de capes **i** la caixa del cercador, que és el que la majoria hi
 * ve a fer. Per això cada capa porta el nom i la pastilla en una sola fila, i
 * els textos són d'una o dues línies.
 *
 * Sota 720px la taula de cada província deixa de ser una taula a la vista i es
 * torna una llista de fitxes, una per consell: cinc columnes en 330px eren
 * noms partits en quatre línies i una barra que s'havia d'arrossegar de
 * costat. Les cel·les porten la seva etiqueta (`data-etiqueta`) i la taula
 * conserva els rols explícits, perquè canviar el `display` d'una taula fa que
 * alguns lectors de pantalla la deixin de llegir com a taula.
 */
export const ENS_INDEX_CSS = `
.ensi-portada{padding:var(--e3) 0}
.ensi-portada h1{font-size:clamp(2.2rem,6.2vw,3rem);max-width:none}
.ensi-portada .resum{font-size:clamp(1.05rem,2.4vw,1.15rem);max-width:50em;margin-top:var(--e2)}

.ensi-capes{margin:var(--e3) 0 0}
.ensi-capa{border:2.5px solid #1E1B2E;border-radius:var(--r-l);color:#1E1B2E;padding:12px var(--e2) var(--e2)}
.ensi-capa p{margin:0}
.ensi-capa-dip{background:var(--presec)}
.ensi-capa-cc{background:var(--lavanda)}
.ensi-capa-aj{background:var(--menta);margin-top:12px}
.ensi-capa-cap{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 12px;margin-bottom:4px}
/* El nom i el seu «una per província» fan una fila que, si no hi cap, es
   parteix sense deixar el segon tros sagnat. */
.ensi-capa-nom{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:8px;font-family:var(--display);
  font-weight:900;font-size:clamp(1.15rem,3vw,1.4rem);letter-spacing:-.02em;line-height:1.15}
.ensi-capa-nom span{font-family:var(--text);font-weight:700;font-size:.875rem;letter-spacing:0;
  color:#524D63;white-space:nowrap}
.ensi-capa-com{font-size:1rem;line-height:1.45}
.ensi-capa-dins{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;margin-top:12px}
@media (min-width:720px){.ensi-capa-dins{grid-template-columns:minmax(0,1fr) 13em;align-items:stretch}}
.ensi-capa-amb{border:2.5px dashed #1E1B2E;border-radius:var(--r-l);padding:12px var(--e2);
  font-size:.9375rem;line-height:1.45;color:#1E1B2E}
.ensi-capa-amb b{font-family:var(--display);font-weight:900;font-size:1.1rem;line-height:1.15;display:block;margin-bottom:4px}
.ensi-capa-amb a{font-weight:800;color:#1E1B2E}
.ensi-xip{display:inline-flex;align-items:center;gap:6px;border:2px solid #1E1B2E;border-radius:var(--r-max);
  background:#FBF7EE;color:#1E1B2E;padding:1px 9px;font-size:.8125rem;font-weight:800;line-height:1.45;white-space:nowrap}
.ensi-xip-vot{background:var(--coral)}
/* El triangle que puja: els regidors surten del ple de baix i seuen al de dalt. */
.ensi-puja::before{content:"";width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
  border-bottom:7px solid #1E1B2E}
.ensi-punts{display:inline-flex;gap:4px;vertical-align:middle;margin-left:6px}
.ensi-punts i{width:10px;height:10px;border-radius:50%;background:#1E1B2E}
.ensi-capes figcaption{margin-top:var(--e2);font-size:1.0625rem;line-height:1.5;max-width:48em}
.ensi-capes figcaption b{font-family:var(--display);font-weight:900}

.ensi-cerca{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-l);
  padding:var(--e3);box-shadow:var(--ombra);margin:0 0 var(--e4)}
.ensi-cerca h2{font-size:clamp(1.3rem,3.6vw,1.65rem);line-height:1.15;margin:0 0 var(--e1)}
.ensi-cerca label{display:block;font-weight:800;margin-bottom:6px}
.ensi-cerca form{display:flex;flex-wrap:wrap;gap:var(--e1)}
.ensi-cerca input{flex:1 1 14em;min-width:0;min-height:48px;padding:0 14px;font:inherit;color:var(--ink);
  background:var(--paper);border:2.5px solid var(--ink);border-radius:var(--r-m)}
.ensi-cerca button{min-height:48px;padding:0 20px;font:inherit;font-weight:800;color:#1E1B2E;
  background:var(--menta);border:2.5px solid #1E1B2E;border-radius:var(--r-max);cursor:pointer}
.ensi-ajuda{font-size:.9375rem;color:var(--ink-suau);margin:var(--e1) 0 0}
.ensi-resultat{margin-top:var(--e2)}
.ensi-resultat:empty{display:none}
.ensi-resultat ul{list-style:none;margin:0;padding:0;display:grid;gap:0}
.ensi-resultat li{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px;padding:10px 0;
  border-bottom:2px solid var(--vora)}
.ensi-resultat li span{font-size:.9375rem;color:var(--ink-suau);font-weight:700;min-width:10em}
.ensi-resultat li a{font-family:var(--display);font-weight:900;font-size:1.15rem}
.ensi-resultat p{margin:var(--e2) 0 0;font-size:1rem}
@media (max-width:480px){.ensi-cerca{padding:var(--e2)}
  .ensi-capa,.ensi-capa-amb{padding:10px 12px 12px}}

.ensi-dem{margin-top:var(--e5)}
.ensi-dem:first-of-type{margin-top:var(--e4)}
.ensi-dem h3{font-family:var(--display);font-weight:900;font-size:clamp(1.4rem,3.8vw,1.85rem);
  letter-spacing:-.02em;line-height:1.1;margin:0 0 var(--e2)}
.ensi-dem h3 a{text-decoration-thickness:2.5px;text-underline-offset:5px}
.ensi-fets{display:flex;flex-wrap:wrap;gap:var(--e2) var(--e4);margin:0 0 var(--e3);font-size:1rem;line-height:1.45}
.ensi-fets > div{display:flex;flex-direction:column;gap:2px;min-width:0}
.ensi-fets dt{font-size:.85rem;color:var(--ink-suau);font-weight:700}
.ensi-fets dd{margin:0;font-weight:800;font-variant-numeric:tabular-nums}
.ensi-fets .ensi-fets-ple{flex:1 1 16em}

.ensi-taula{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:.9375rem;line-height:1.45}
.ensi-taula th,.ensi-taula td{padding:14px 12px;text-align:left;vertical-align:top;border-bottom:2px solid var(--vora)}
.ensi-taula th:first-child{padding-left:0}
.ensi-taula td:last-child{padding-right:0}
.ensi-taula thead th{font-size:.85rem;font-weight:800;color:var(--ink-suau);border-bottom:2.5px solid var(--ink);
  padding-top:0;padding-bottom:8px;vertical-align:bottom}
.ensi-taula .ensi-num{text-align:right;white-space:nowrap}
.ensi-taula th[scope="row"]{font-weight:400}
.ensi-taula th[scope="row"] a{font-family:var(--display);font-weight:900;font-size:1.1rem;line-height:1.2;text-decoration:none}
.ensi-taula th[scope="row"] a:hover{text-decoration:underline;text-decoration-thickness:2.5px}
.ensi-taula caption{text-align:left;caption-side:top;font-size:.9375rem;color:var(--ink-suau);padding-bottom:var(--e1)}
.ensi-taula tbody tr:hover{background:var(--paper-2)}
.ensi-c-ple{width:30%}
.ensi-c-pres{width:28%}
.ensi-sec{display:block;font-size:.85rem;line-height:1.4;color:var(--ink-suau);font-weight:700;margin-top:2px}
.ensi-sec a{color:inherit}
.ensi-buit{color:var(--ink-suau);font-weight:400;font-size:.9375rem}
.ensi-partit{font-size:.85rem;color:var(--ink-suau);font-weight:700;white-space:nowrap}
.ensi-xifra{font-weight:800}

.ensi-barra{display:flex;height:14px;min-width:9em;max-width:18em;border:2px solid var(--ink);
  border-radius:var(--r-max);overflow:hidden;background:var(--paper)}
.ensi-barra span{display:block;min-width:2px}
.ensi-barra span + span{border-left:1.5px solid var(--paper)}
.ensi-barra .ensi-sense{background:var(--vora)}
.ensi-llegenda{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 12px;
  font-size:.85rem;line-height:1.35;font-weight:700;font-variant-numeric:tabular-nums}
.ensi-llegenda li{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.ensi-llegenda i{flex:none;width:10px;height:10px;border-radius:50%;border:1.5px solid var(--ink)}
.ensi-llegenda i.ensi-sense{background:var(--vora)}
.ensi-llegenda .ensi-mes,.ensi-llegenda .ensi-sp{color:var(--ink-suau)}

@media (max-width:719px){
  .ensi-taula,.ensi-taula tbody,.ensi-taula caption{display:block}
  .ensi-taula thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .ensi-taula tr{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--e1) var(--e2);
    padding:var(--e2) 0;border-bottom:2px solid var(--vora)}
  .ensi-taula tbody tr:hover{background:none}
  .ensi-taula th,.ensi-taula td{padding:0;border:0;width:auto}
  .ensi-taula th[scope="row"],.ensi-taula .ensi-c-pres,.ensi-taula .ensi-c-ple{grid-column:1/-1}
  .ensi-taula .ensi-num{text-align:left;white-space:normal}
  .ensi-taula td[data-etiqueta]::before{content:attr(data-etiqueta);display:block;font-size:.85rem;
    color:var(--ink-suau);font-weight:700;margin-bottom:2px}
  .ensi-barra{max-width:none}
  .ensi-fets{gap:var(--e2) var(--e3)}
}

.ensi-excepcions{margin:0;display:grid;grid-template-columns:minmax(0,1fr);gap:0}
@media (min-width:720px){.ensi-excepcions{grid-template-columns:11em minmax(0,1fr);column-gap:var(--e3)}}
.ensi-excepcions dt{font-family:var(--display);font-weight:900;font-size:1.2rem;padding-top:var(--e2)}
.ensi-excepcions dd{margin:0;padding:var(--e1) 0 var(--e2);border-bottom:2px solid var(--vora);line-height:1.5}
@media (min-width:720px){.ensi-excepcions dt{border-bottom:2px solid var(--vora);padding-bottom:var(--e2)}
  .ensi-excepcions dd{padding-top:var(--e2)}}
.ensi-nota{font-size:1rem;color:var(--ink-suau);max-width:44em;margin:0 0 var(--e2)}
@media (prefers-reduced-motion:reduce){.ensi-cerca *{transition:none}}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Les peces de la pàgina
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un color de dada que es pot posar en un `style=""` sense por: només
 * hexadecimal de tres o sis xifres, com a la resta de pàgines. Qualsevol altra
 * cosa es descarta i el tros de barra surt neutre, com el d'un partit sense
 * color.
 */
export function colorSegur(color: string | null): string | null {
  if (!color) return null;
  const net = color.trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(net) ? net : null;
}

const seients = (n: number): string => `${number(n)} ${n === 1 ? "seient" : "seients"}`;

/**
 * El que diu la composició quan no se sap amb quines sigles hi seu algú. És el
 * mateix text que `SENSE_PARTIT` d'`ens-dades.ts`; s'escriu aquí perquè els
 * dos fitxers no depenguin l'un de l'altre per una cadena.
 */
const SENSE_PARTIT = "sense partit conegut";

/** Quants partits diu la llegenda abans de «i N més». */
const LLEGENDA_VISIBLES = 4;

export type FilaComposicio = { partit: string; seients: number; color: string | null };

/**
 * Les files de la composició del ple, agrupades per la clau comparable de
 * cada partit (`MembreEns.grup`).
 *
 * El registre de plens escriu cada candidatura a la seva manera —«PSC-CP»,
 * «BComúP - C», «ERC-AM»— i, si cada etiqueta fos un tros de barra, el ple de
 * la Diputació de Barcelona tindria tres «Comuns» diferents. Quan hi ha
 * membres, les files surten del seu `grup`, que és la clau amb què el
 * carregador fa la composició i el repartiment; si no n'hi ha (la font no dona
 * els noms), es fa servir `composicio` tal com ve.
 *
 * L'ordre és de més a menys seients, amb un empat per nom (que no vol dir res
 * i per això és neutral) i, sempre a la cua i en una sola fila, els seients
 * dels quals no se sap el partit.
 */
export function filesComposicio(
  e: Pick<DadesEns, "composicio"> & { membres?: readonly Pick<MembreEns, "grup" | "color">[] },
): FilaComposicio[] {
  const perGrup = new Map<string, FilaComposicio>();
  const suma = (partit: string | null | undefined, n: number, color: string | null): void => {
    const net = (partit ?? "").replace(/\s+/g, " ").trim();
    const clau = net === "" || net === "-" || net === SENSE_PARTIT ? SENSE_PARTIT : net;
    const fila = perGrup.get(clau) ?? { partit: clau, seients: 0, color: null };
    fila.seients += n;
    if (!fila.color && clau !== SENSE_PARTIT) fila.color = colorSegur(color);
    perGrup.set(clau, fila);
  };
  const membres = e.membres ?? [];
  if (membres.length > 0) for (const m of membres) suma(m.grup, 1, m.color);
  else for (const f of e.composicio) suma(f.partit, f.seients, f.color);
  return [...perGrup.values()]
    .filter((f) => f.seients > 0)
    .sort(
      (a, b) =>
        Number(a.partit === SENSE_PARTIT) - Number(b.partit === SENSE_PARTIT) ||
        b.seients - a.seients ||
        a.partit.localeCompare(b.partit, "ca"),
    );
}

/**
 * La composició del ple en una barra fina: un tros per partit, amb el color de
 * dada del partit i l'amplada dels seus seients.
 *
 * La barra és una imatge amb la frase sencera a l'`aria-label`: tots els
 * partits, un per un. La llegenda de sota és per a la vista i en diu només els
 * quatre primers i «i N més»: el ple d'un consell pot tenir deu llistes locals
 * d'un seient, i deu pastilles diminutes per fila no les llegia ningú. Qui
 * vulgui la llista sencera la té a la fitxa de l'ens, i passant per damunt de
 * cada tros. Els seients sense partit conegut sempre es diuen, al final,
 * perquè un buit s'ha de veure.
 *
 * Si la font només dona el partit d'una part del ple, la fila ho diu: la barra
 * no s'estira per semblar plena.
 */
export function barraComposicio(
  e: Pick<DadesEns, "composicio" | "seients"> & { membres?: readonly Pick<MembreEns, "grup" | "color">[] },
): string {
  const files = filesComposicio(e);
  if (files.length === 0) return `<span class="ensi-buit">no consta</span>`;
  const coneguts = files.filter((f) => f.partit !== SENSE_PARTIT);
  const sense = files.find((f) => f.partit === SENSE_PARTIT) ?? null;
  const total = files.reduce((a, f) => a + f.seients, 0);
  const frase = files.map((f) => `${f.partit}, ${seients(f.seients)}`).join("; ");
  const trossos = files
    .map((f) => {
      const dada = { nom: f.partit, valor: seients(f.seients) };
      const estil = `flex:${f.seients} 1 0${f.color ? `;background:${f.color}` : ""}`;
      return `<span${f.color ? "" : ' class="ensi-sense"'} style="${escape(estil)}"${atributsEtiqueta(dada)} title="${escape(textEtiqueta(dada))}"></span>`;
    })
    .join("");
  // «i 1 més» ocupa el mateix que el partit que amagaria: si només en sobra
  // un, es diu.
  const visibles = coneguts.length === LLEGENDA_VISIBLES + 1 ? coneguts : coneguts.slice(0, LLEGENDA_VISIBLES);
  const amagats = coneguts.length - visibles.length;
  const llegenda = [
    ...visibles.map(
      (f) =>
        `<li><i${f.color ? ` style="background:${escape(f.color)}"` : ' class="ensi-sense"'}></i>${escape(f.partit)} ${number(f.seients)}</li>`,
    ),
    ...(amagats > 0 ? [`<li class="ensi-mes">i ${number(amagats)} més</li>`] : []),
    ...(sense ? [`<li class="ensi-sp"><i class="ensi-sense"></i>${number(sense.seients)} sense partit conegut</li>`] : []),
  ].join("");
  const parcial =
    total < e.seients
      ? `<span class="ensi-sec">${number(total)} de ${seients(e.seients)} amb partit conegut</span>`
      : "";
  return `<div class="ensi-barra" role="img" aria-label="${escape(`Composició del ple: ${frase}`)}">${trossos}</div>
<ul class="ensi-llegenda" aria-hidden="true">${llegenda}</ul>${parcial}`;
}

/**
 * Qui presideix l'ens, amb el seu partit i el ple d'on ve.
 *
 * El nom passa sempre per `nomLlegible()`: el registre de plens n'escriu molts
 * en majúscules i, al costat d'un nom ben escrit a la fila de sota, semblava
 * que la persona cridés. El partit és la clau comparable (`grup`, «PSC») i no
 * l'etiqueta literal de la font («PSC-CP»): és la mateixa que diu la barra.
 */
export function celaPresidencia(p: MembreEns | null, base: string): string {
  if (!p) return `<span class="ensi-buit">no consta</span>`;
  const nom = escape(nomLlegible(p.nom));
  // Només s'enllaça la persona si l'aparellament amb el ple municipal és únic:
  // és el que vol dir que `adreca` no sigui null.
  const persona =
    p.municipi && p.adreca ? `<a href="${escape(`${base}m/${p.municipi.slug}/${p.adreca}`)}">${nom}</a>` : nom;
  const grup = p.grup && p.grup !== SENSE_PARTIT ? p.grup : null;
  const partit = grup ? ` <span class="ensi-partit">(${escape(grup)})</span>` : "";
  const enllacMunicipi = p.municipi
    ? `<a href="${escape(`${base}m/${p.municipi.slug}/`)}">${escape(de(p.municipi.nom))}</a>`
    : "";
  const origen = p.municipi
    ? `<span class="ensi-sec">${p.alcaldia ? `té l'alcaldia ${enllacMunicipi}` : `del ple ${enllacMunicipi}`}</span>`
    : "";
  return `${persona}${partit}${origen}`;
}

/**
 * Uns euros per habitant dits amb la precisió que tenen sentit.
 *
 * A partir de 10 €, sense decimals: «74 €». Per sota, amb un decimal, perquè
 * «3 €» i «4 €» poden ser el mateix número arrodonit de dues maneres: «3,4 €».
 * Per sota de 0,1 € el decimal ja diria «0,0 €», que sembla un zero, i es diu
 * «menys de 0,1 €». Només un zero de debò de la font s'escriu «0 €».
 */
export function eurosPerHabitant(euros: number): string {
  const unDecimal = Math.round(euros * 10) / 10;
  if (unDecimal >= 10) return `${number(Math.round(euros))}&nbsp;€`;
  if (unDecimal >= 0.1) {
    return `${unDecimal.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}&nbsp;€`;
  }
  if (euros > 0) return `menys de 0,1&nbsp;€`;
  return `0&nbsp;€`;
}

/**
 * La despesa per habitant de l'últim exercici, amb l'any al costat, o «no
 * consta». La xifra és la de `ultimaDespesa()`, la mateixa que diu la fitxa de
 * l'ens: si aquí se'n calculés una altra, l'índex i la fitxa es
 * contradirien. Un exercici que encara no és definitiu (`parcial`) es diu en
 * veu baixa, «2025, provisional», al costat de l'any.
 */
export function celaDespesa(e: DadesEns): string {
  const d = ultimaDespesa(e);
  if (!d || d.perHabitant === null) return `<span class="ensi-buit">no consta</span>`;
  const any = d.parcial ? `${d.any}, provisional` : String(d.any);
  return `<span class="ensi-xifra">${eurosPerHabitant(d.perHabitant)}</span><span class="ensi-sec">per habitant, ${any}</span>`;
}

/** «de 19 a 39», o un sol número si tots en tenen els mateixos. Buit si no n'hi ha cap. */
function rangSeients(llista: readonly DadesEns[]): string {
  const n = llista.map((e) => e.seients).filter((s) => s > 0);
  if (n.length === 0) return "";
  const min = Math.min(...n);
  const max = Math.max(...n);
  return min === max ? number(min) : `de ${number(min)} a ${number(max)}`;
}

/**
 * El dibuix de les capes: la diputació conté el consell, el consell conté
 * l'ajuntament, i al costat del consell, l'AMB, que només toca uns quants
 * municipis. Són caixes dins de caixes perquè és exactament el que són: cada
 * ple de dalt està fet de gent del ple de baix.
 *
 * Només l'ajuntament porta la pastilla de corall «el votes tu»: és l'única capa
 * que surt d'una papereta. Les altres porten el triangle que puja, «hi seuen
 * regidors», que és la idea que la pàgina vol deixar: votes una vegada i aquell
 * vot fa tres plens. La pastilla va a la mateixa fila que el nom de la capa, i
 * no a sota, perquè el dibuix sencer i el cercador càpiguen a la primera
 * pantalla.
 */
function dibuixCapes(
  diputacions: readonly DadesEns[],
  consells: readonly DadesEns[],
  municipis: number,
  base: string,
): string {
  const rangDip = rangSeients(diputacions);
  const rangCc = rangSeients(consells);
  const punts = `<span class="ensi-punts" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>`;
  const puja = `<span class="ensi-xip ensi-puja">hi seuen regidors</span>`;
  return `<figure class="ensi-capes" aria-labelledby="ensi-capes-peu">
  <div class="ensi-capa ensi-capa-dip">
    <div class="ensi-capa-cap">
      <p class="ensi-capa-nom">La diputació <span>una per província${
        diputacions.length ? ` · ${number(diputacions.length)} a Catalunya` : ""
      }</span></p>
      ${puja}
    </div>
    <p class="ensi-capa-com">Ajuda els ajuntaments petits: diners, carreteres locals, tècnics, cultura.${
      rangDip ? ` El ple té ${rangDip} diputats.` : ""
    }</p>
    <div class="ensi-capa-dins">
      <div class="ensi-capa ensi-capa-cc">
        <div class="ensi-capa-cap">
          <p class="ensi-capa-nom">El consell comarcal <span>un per comarca${
            consells.length ? ` · ${number(consells.length)} a Catalunya` : ""
          }</span></p>
          ${puja}
        </div>
        <p class="ensi-capa-com">Fa el que un poble sol no pot fer: sovint, transport escolar, serveis socials, residus.${
          rangCc ? ` El ple té ${rangCc} consellers.` : ""
        }</p>
        <div class="ensi-capa ensi-capa-aj">
          <div class="ensi-capa-cap">
            <p class="ensi-capa-nom">El teu ajuntament <span>${number(municipis)} a Catalunya</span></p>
            <span class="ensi-xip ensi-xip-vot">el votes tu</span>
          </div>
          <p class="ensi-capa-com">El ple de regidors del teu poble, i l'alcaldia que en surt.${punts}</p>
        </div>
      </div>
      <div class="ensi-capa-amb">
        <b>I a l'entorn de Barcelona, l'AMB</b>
        36 municipis hi comparteixen autobús, aigua i residus. Tampoc no es vota: hi seuen
        alcaldes i regidors.
        <a href="${escape(base)}amb/">Com funciona l'AMB</a>
      </div>
    </div>
  </div>
  <figcaption id="ensi-capes-peu"><b>Votes una vegada, i el teu vot fa tres plens.</b> Amb els vots
  de les municipals es fa l'ajuntament, i amb els mateixos vots es reparteixen els seients del consell
  comarcal i de la diputació, que no tenen papereta pròpia. Només l'Aran vota directament el seu
  Conselh Generau.</figcaption>
</figure>`;
}

/**
 * El cercador «i el teu poble?», just després del dibuix i amb el títol a dins
 * de la caixa, perquè es llegeixi com una sola peça i càpiga a la primera
 * pantalla. Va amagat (`hidden`) i el script el destapa quan ha llegit les
 * dades: sense JavaScript no hi ha caixa morta, i la llista de sota ja diu el
 * mateix província per província.
 */
function cercadorPoble(dades: string): string {
  return `<section class="ensi-cerca" id="ensi-cerca" hidden aria-labelledby="ensi-cerca-titol">
  <h2 id="ensi-cerca-titol">De quin consell i de quina diputació és el teu poble?</h2>
  <label for="ensi-tria">El teu municipi</label>
  <form id="ensi-form" role="search" aria-label="Busca el consell i la diputació del teu municipi">
    <input id="ensi-tria" type="search" list="ensi-llista" autocomplete="off" spellcheck="false"
      aria-describedby="ensi-ajuda">
    <button type="submit">Busca</button>
  </form>
  <datalist id="ensi-llista"></datalist>
  <p class="ensi-ajuda" id="ensi-ajuda">Tria'l de la llista o escriu el nom sencer i prem Retorn.</p>
  <div class="ensi-resultat" id="ensi-resultat" role="status" aria-live="polite"></div>
  <script type="application/json" id="ensi-dades">${dades}</script>
</section>`;
}

/** La capçalera d'una diputació: nom, qui la presideix, seients, despesa i ple. */
function capDiputacio(d: DadesEns, base: string): string {
  return `<h3 id="ensi-${escape(d.slug)}"><a href="${escape(base + adrecaEns(d.tipus, d.slug))}">${escape(d.nom)}</a></h3>
  <dl class="ensi-fets">
    <div><dt>Qui la presideix</dt><dd>${celaPresidencia(d.presidencia, base)}</dd></div>
    <div><dt>Seients</dt><dd>${number(d.seients)}</dd></div>
    <div><dt>Despesa</dt><dd>${celaDespesa(d)}</dd></div>
    <div class="ensi-fets-ple"><dt>El ple</dt><dd>${barraComposicio(d)}</dd></div>
  </dl>`;
}

/**
 * Una fila de consell dins la taula de la seva demarcació. Cada cel·la porta
 * la seva etiqueta a `data-etiqueta`: sota 720px la capçalera de la taula
 * s'amaga i l'etiqueta la substitueix a sobre de cada dada.
 */
function filaConsell(c: GrupDemarcacio["consells"][number], base: string): string {
  const { ens, altresProvincies } = c;
  const altres = altresProvincies.length
    ? `<span class="ensi-sec">també té municipis de ${escape(altresProvincies.join(" i "))}</span>`
    : "";
  return `<tr role="row">
      <th scope="row" role="rowheader"><a href="${escape(base + adrecaEns(ens.tipus, ens.slug))}">${escape(ens.territori)}</a>${altres}</th>
      <td role="cell" class="ensi-c-pres" data-etiqueta="Qui el presideix">${celaPresidencia(ens.presidencia, base)}</td>
      <td role="cell" class="ensi-num" data-etiqueta="Seients">${number(ens.seients)}</td>
      <td role="cell" class="ensi-num" data-etiqueta="Despesa">${celaDespesa(ens)}</td>
      <td role="cell" class="ensi-c-ple" data-etiqueta="El ple">${barraComposicio(ens)}</td>
    </tr>`;
}

/** Una província sencera: la seva diputació i, a sota, la taula dels seus consells. */
function blocDemarcacio(g: GrupDemarcacio, base: string): string {
  const cap = g.diputacio
    ? capDiputacio(g.diputacio, base)
    : `<h3>Consells sense província identificada</h3>
  <p class="ensi-nota">No s'ha pogut saber de quina província és la seu d'aquests consells.</p>`;
  const nom = g.diputacio ? g.diputacio.territori : "sense província";
  const taula = g.consells.length
    ? `<table class="ensi-taula" role="table">
    <caption>Els consells comarcals amb seu a ${escape(
      g.diputacio ? `la província de ${nom}` : "una província que no consta",
    )}</caption>
    <thead role="rowgroup"><tr role="row">
      <th scope="col" role="columnheader">Consell comarcal</th>
      <th scope="col" role="columnheader">Qui el presideix</th>
      <th scope="col" role="columnheader" class="ensi-num">Seients</th>
      <th scope="col" role="columnheader" class="ensi-num">Despesa</th>
      <th scope="col" role="columnheader">El ple</th>
    </tr></thead>
    <tbody role="rowgroup">${g.consells.map((c) => filaConsell(c, base)).join("")}</tbody>
  </table>`
    : `<p class="ensi-nota">No hi ha cap consell comarcal publicat amb seu en aquesta província.</p>`;
  return `<div class="ensi-dem">
  ${cap}
  ${taula}
</div>`;
}

/**
 * Les excepcions, dites cadascuna en dues frases. Els noms de comarca porten a
 * la seva fitxa quan la comarca surt a les dades de municipis; si no hi surt,
 * no s'enllaça cap adreça que podria no existir.
 */
function blocExcepcions(municipis: readonly MunicipiIndex[], base: string): string {
  const nomComarca = (exc: Excepcio): string | null =>
    municipis.find((m) => excepcioDe(m.comarca) === exc)?.comarca ?? null;
  const comarca = (exc: Excepcio, text: string): string => {
    const nom = nomComarca(exc);
    return nom ? `<a href="${escape(`${base}c/${slugify(nom)}/`)}">${escape(text)}</a>` : escape(text);
  };
  return `<section class="bloc" aria-labelledby="ensi-excepcions">
  <h2 id="ensi-excepcions">On no és així</h2>
  <p class="ensi-nota">Tres comarques no tenen consell comarcal, i al voltant de Barcelona hi ha una capa més.</p>
  <dl class="ensi-excepcions">
    <dt>${comarca("barcelones", "Barcelonès")}</dt>
    <dd>No té consell comarcal des del 2019: el Parlament el va dissoldre amb la Llei 1/2019. Els
    seus cinc municipis són dins de l'Àrea Metropolitana, i la diputació que els toca és la de Barcelona.</dd>
    <dt>${comarca("llucanes", "Lluçanès")}</dt>
    <dd>És comarca des del 2023, però encara no té consell comarcal propi: el primer es farà amb els
    resultats de les municipals del maig del 2027. Fins llavors, els seus regidors del 2023 són al
    Consell Comarcal d'Osona, i una mancomunitat dels seus municipis fa part de la feina comarcal.</dd>
    <dt>${comarca("aran", "Aran")}</dt>
    <dd>En lloc de consell comarcal té el Conselh Generau d'Aran, amb un règim propi. És l'únic
    d'aquests plens que els veïns voten directament, amb papereta pròpia, el mateix dia que les
    municipals. La seva web és <a href="https://www.conselharan.org/" rel="noopener">conselharan.org</a>.</dd>
    <dt><a href="${escape(base)}amb/">L'AMB</a></dt>
    <dd>L'Àrea Metropolitana de Barcelona agrupa 36 municipis de cinc comarques per a l'autobús,
    l'aigua, els residus i l'urbanisme. Tampoc no es vota directament: el seu ple el formen alcaldes
    i regidors dels 36 ajuntaments. Té la seva pàgina a l'Observatori.</dd>
  </dl>
</section>`;
}

/** Les fonts que citen les fitxes, sense repetir-ne cap (per adreça). */
export function fontsUniques(llista: readonly DadesEns[]): FontEns[] {
  const perUrl = new Map<string, FontEns>();
  for (const e of llista) {
    for (const f of [...e.fonts, ...(e.finances?.fonts ?? [])]) {
      if (!perUrl.has(f.url)) perUrl.set(f.url, f);
    }
  }
  return [...perUrl.values()].sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
}

function blocFonts(llista: readonly DadesEns[]): string {
  const deLesFitxes = fontsUniques(llista)
    .map(
      (f) =>
        `<li><a href="${escape(f.url)}" rel="noopener">${escape(f.nom)}</a>${
          f.consultat ? `, ${escape(consultatEl(f.consultat))}` : ""
        }${f.llicencia ? ` (${escape(f.llicencia)})` : ""}.</li>`,
    )
    .join("");
  return `<section class="bloc fonts">
  <h2>D'on surt tot això</h2>
  <ul>
    <li>Quins ens hi ha, qui els presideix i on tenen la seu: registre d'ens locals de la Generalitat, <code>6nei-4b44</code>.</li>
    <li>Qui seu a cada ple i amb quin partit: registre de plens dels ens locals, <code>nm3n-3vbj</code>. Els
      noms de les diputacions de Barcelona i Girona, de les seves webs.</li>
    <li>La comarca i la província de cada municipi: Generalitat de Catalunya, <code>ehvx-5ty7</code>.</li>
    <li>Despesa liquidada (obligacions reconegudes, tots els capítols): Consorci AOC, <code>81f18313</code>.
      Per habitant, partida pel padró dels municipis de l'àmbit.</li>
    <li>Com es reparteixen els seients: LOREG, articles 204 a 206 (diputacions), i Decret legislatiu
      4/2003, article 20 (consells comarcals).</li>
    <li>Dissolució del Consell Comarcal del Barcelonès: Llei 1/2019.</li>
    ${deLesFitxes}
  </ul>
  <p class="nota">La despesa per habitant és la d'un sol pagador, l'ens de la fila: no se suma mai amb la
  dels ajuntaments ni amb la d'un altre ens. On una font no publica una dada, hi diu «no consta», i no
  un zero.</p>
</section>`;
}

/**
 * El script del cercador. Llegeix les dades de `#ensi-dades`, omple el
 * `<datalist>` i, quan el que s'ha escrit és un municipi, escriu el resultat
 * amb `textContent` i `href` (mai `innerHTML`): un nom estrany no pot injectar
 * res. Si les dades no es poden llegir, la caixa es queda amagada.
 */
export const ENS_INDEX_JS = `<script id="ensi-script">
(function () {
  var caixa = document.getElementById("ensi-cerca");
  var font = document.getElementById("ensi-dades");
  if (!caixa || !font) return;
  var d;
  try { d = JSON.parse(font.textContent); } catch (e) { return; }
  var camp = document.getElementById("ensi-tria");
  var sortida = document.getElementById("ensi-resultat");
  var llista = document.getElementById("ensi-llista");
  function net(t) { return t.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim(); }
  var tros = document.createDocumentFragment();
  d.m.forEach(function (m) { var o = document.createElement("option"); o.value = m[0]; tros.appendChild(o); });
  llista.appendChild(tros);
  function paragraf(text) { var p = document.createElement("p"); p.textContent = text; sortida.appendChild(p); return p; }
  function enllac(text, href) { var a = document.createElement("a"); a.textContent = text; a.href = href; return a; }
  function mostra(m) {
    sortida.textContent = "";
    var ul = document.createElement("ul");
    function fila(etiqueta, text, href) {
      var li = document.createElement("li"); var s = document.createElement("span");
      s.textContent = etiqueta; li.appendChild(s); li.appendChild(enllac(text, href)); ul.appendChild(li);
    }
    fila("El teu ajuntament", m[0], d.base + "m/" + m[1] + "/");
    if (m[3] >= 0) fila("El teu consell comarcal", d.e[m[3]].n, d.e[m[3]].u);
    if (m[4] >= 0) fila("La teva diputació", d.e[m[4]].n, d.e[m[4]].u);
    sortida.appendChild(ul);
    var x = m[5] ? d.x[m[5]] : null;
    if (x) {
      var p = paragraf(x.t + " ");
      if (x.u) p.appendChild(enllac(x.n, x.u));
    } else if (m[3] < 0) {
      paragraf(m[2] ? "No trobem el consell comarcal de: " + m[2] + "." : "No consta de quina comarca és.");
    }
    if (m[4] < 0) paragraf("No consta de quina diputació és.");
  }
  function busca(decidit) {
    var q = net(camp.value);
    if (!q) { sortida.textContent = ""; return; }
    var iguals = d.m.filter(function (m) { return net(m[0]) === q; });
    if (iguals.length === 1) { mostra(iguals[0]); return; }
    if (!decidit) return;
    var comencen = d.m.filter(function (m) { return net(m[0]).indexOf(q) === 0; });
    if (comencen.length === 1) { mostra(comencen[0]); return; }
    sortida.textContent = "";
    paragraf(comencen.length ? comencen.length + " municipis comencen així. Tria el teu de la llista." : "No trobem cap municipi amb aquest nom.");
  }
  camp.addEventListener("input", function () { busca(false); });
  document.getElementById("ensi-form").addEventListener("submit", function (ev) { ev.preventDefault(); busca(true); });
  caixa.hidden = false;
})();
</script>`;

/**
 * El títol per al cercador, amb el nom de la cosa al davant.
 *
 * Abans era «Qui governa per sobre del teu ajuntament», que és una bona
 * portada però un mal títol de resultat: no diu cap de les dues paraules que
 * algú escriu quan busca això («diputació», «consell comarcal»), i el cercador
 * dona més pes a les primeres paraules del títol. La frase de portada es queda
 * a l'`h1`, que és on la llegeix qui ja hi ha entrat. Amb « · quivoto» fa 55
 * lletres: hi cap la marca.
 */
export const TITOL_ENS_INDEX = "Diputacions i consells comarcals: qui hi mana";

/**
 * De quan són les dades de l'índex: el dia de consulta més recent de les
 * fitxes que llista (`DadesEns.consultat`). No la data de la publicació, per
 * la mateixa raó que a cada fitxa: tornar a escriure la pàgina amb les
 * mateixes dades no la fa més nova. Sense cap ens, `null`, i el cap no en diu
 * res.
 */
export function dataDeLesDades(llista: readonly Pick<DadesEns, "consultat">[]): string | null {
  const dates = llista.map((e) => e.consultat).filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d ?? ""));
  return dates.length > 0 ? dates.reduce((max, d) => (d > max ? d : max)) : null;
}

/**
 * La pàgina `observatori/ens/index.html`.
 *
 * @param llista Les diputacions i els consells, en qualsevol ordre.
 * @param municipis Tots els municipis, amb la seva comarca i província: en
 *   surten el cercador i la ratlla de província de cada consell.
 * @param generatedAt Quan s'ha escrit la pàgina.
 */
export function renderEnsIndex(
  llista: readonly DadesEns[],
  municipis: readonly MunicipiIndex[],
  generatedAt: string,
): string {
  const base = "../";
  const diputacions = llista.filter((e) => e.tipus === "diputacio");
  const consells = llista.filter((e) => e.tipus === "consell");
  const grups = agrupaPerDemarcacio(llista, municipis);

  const url = `${SITE}/observatori/ens/`;
  const nDip = number(diputacions.length);
  const nCc = number(consells.length);
  const cap = capSeo({
    titol: TITOL_ENS_INDEX,
    descripcio: `Les ${nDip} diputacions i els ${nCc} consells comarcals: qui els presideix, quants seients tenen, quant gasten per habitant i de quins partits és el ple.`,
    url,
    imatge: imatgeOg(FITXER_OG.ens()),
    dataModificacio: dataDeLesDades(llista),
    jsonLd: [filAriadna([...ARREL_OBSERVATORI, { nom: "Diputacions i consells comarcals", url }])],
  });

  const llistat =
    llista.length === 0
      ? `<p class="ensi-nota">Encara no hi ha cap diputació ni cap consell publicat.</p>`
      : grups.map((g) => blocDemarcacio(g, base)).join("\n");

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${cap}
${tipografia(base)}
<style>${RADIOGRAFIA_CSS}${ENS_INDEX_CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>

${capcalera(base, "cap")}
${cercador(base)}

<main id="contingut">

<section class="ensi-portada">
  <h1>Qui governa per sobre del teu ajuntament</h1>
  <p class="resum">El teu poble és dins d'una comarca i d'una província, i cada una té el seu govern:
  el consell comarcal i la diputació. Gestionen diners i serveis que notes cada dia, però no els
  has votat mai directament.</p>
  ${dibuixCapes(diputacions, consells, municipis.length, base)}
</section>

${cercadorPoble(dadesCercador(llista, municipis, base))}

<section class="bloc" aria-labelledby="ensi-llista-titol">
  <h2 id="ensi-llista-titol">Les ${nDip} diputacions i els ${nCc} consells, província per província</h2>
  <p class="ensi-nota">Cada consell va sota la diputació de la província on té la seu. La barra és el
  ple, amb els colors de cada partit, i sota hi ha els quatre partits amb més seients. La despesa és la
  liquidada de l'últim exercici que publica l'ens, partida pels habitants del seu territori. Cada nom
  porta a la seva fitxa.</p>
  ${llistat}
</section>

${blocExcepcions(municipis, base)}

${blocFonts(llista)}

</main>

${peu(base, generatedAt)}
${GRAFICS_JS}
${ENS_INDEX_JS}
</body>
</html>`;
}
