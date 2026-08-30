import { eq } from "drizzle-orm";
import {
  candidatures, electionParticipation, municipalities, municipalityMetrics, type Db,
} from "@quivoto/db";
import { BRANDS_BY_ID, siglesFamily } from "@quivoto/shared-schemas/brands";
import { sobreColor } from "./contrast";
import { carregaMetriques } from "./metriques";
import { RADIOGRAFIA_CSS } from "./estil";
import { MASCOTA_CSS, papereta } from "./mascota";
import { icona } from "./icones";
import { partitDe, sigla } from "./sigla";
import { SITE } from "./config";
import { nomLlegible, slugify } from "../lib/text";
import { capcalera } from "./capcalera";
import { cercador } from "./cercador";
import { peu } from "./peu";

/**
 * «Els 947» — l'índex de tots els municipis de Catalunya amb el que en sabem.
 *
 * 947 és el nombre de municipis que té Catalunya, i la pàgina existeix per
 * ensenyar-los tots amb la seva dada: no una demostració amb tres pobles triats,
 * sinó els 947 alhora, amb el que en sabem i el forat on no n'hi ha.
 *
 * El nom coincideix amb el d'els947.cat, un joc de geografia catalana. La
 * coincidència és de la xifra i de res més: el joc és d'una altra gent, no hi
 * tenim cap relació ni cap acord, i aquesta pàgina no en depèn gens. L'enllaç
 * que hi ha a baix és un guinyo, i s'ha de continuar llegint com a tal.
 *
 * La llista va escrita a l'HTML, fila a fila: sense JavaScript es llegeix
 * sencera i s'arriba a totes les fitxes. Els filtres són caselles i CSS, i el
 * cercador és l'única peça que necessita el navegador. No surt res d'aquí: ni
 * peticions ni manera de saber qui mira què.
 */

export type Els947Row = {
  /** slug, nom, comarca, població, regidories */
  s: string; n: string; c: string; p: number; r: number;
  /** alcaldia i sigles */
  a: string | null; g: string | null;
  /** el retrat que publica el mateix ajuntament, si en publica */
  ar: string | null;
  /** el color de la força de l'alcaldia, quan se'n pot saber la marca (vegeu «b») */
  ac: string | null;
  /** governa el més votat: 1 sí, 0 no, null desconegut */
  w: 0 | 1 | null;
  /** majoria absoluta d'una sola llista */
  m: 0 | 1;
  /** canvi d'alcaldia a mig mandat */
  k: 0 | 1;
  /** actes indexades */
  t: number;
  /** deute per habitant, en euros */
  d: number | null;
  /** estalvi net en percentatge */
  e: number | null;
  /** dones al ple, en percentatge */
  f: number | null;
  /** canvis de la força més votada des del 1979, i quantes eleccions */
  v: number | null; q: number | null;
  /** compliment del portal de transparència, en percentatge */
  y: number | null;
  /** ple amb una sola candidatura */
  o: 0 | 1;
  /*
   * Els quatre camps que vénen ara són opcionals i la resta no. No és una
   * llicència per oblidar-los: `loadEls947()` els escriu sempre, i qui els
   * llegeixi ha de tractar el «no hi és» igual que el `null`. Són opcionals
   * perquè `mapa-ara.ts` —la vista prèvia del mapa, que es fa una fila a mà per
   * a cada municipi sense tocar la base de dades— es quedaria sense compilar
   * cada cop que aquesta llista creix, i llavors no hi hauria manera de mirar
   * el mapa mentre es fa.
   */
  /**
   * De quina marca és l'alcaldia: **primer el codi d'agrupació del dataset
   * electoral** i, si aquell no ho diu, les sigles.
   *
   * Endevinar l'acrònim és el que deixava 94 municipis en gris al mapa amb
   * 640.193 habitants a dins: «EPCP-C» és El Prat en Comú Podem i l'expressió
   * dels comuns busca «ecp» o «en-comu», que allà van plegats dins d'un acrònim
   * que només existeix al Prat. El codi d'agrupació no s'ha d'endevinar —és la
   * Generalitat qui diu sota quina agrupació es presenta cada llista— i
   * `AGRUPACIO_TO_BRAND` ja el tradueix. Comparat amb `siglesFamily()` sobre les
   * 2.626 candidatures del 2023, coincideixen 2.189 vegades i en xoquen cinc,
   * totes cinc coalicions amb dos noms a les sigles.
   *
   * Que el codi digui `local` no és una negació i per això no es fa servir per
   * despintar res: 3.000.000 és alhora el codi de les agrupacions d'electors i
   * la casella on cau tot allò que encara no s'ha repassat. En aquests casos
   * mana el que diguin les sigles, que a Tiana és «JUNTS» escrit sencer.
   */
  b?: string | null;
  /** participació a les municipals del 2023, en percentatge */
  pt?: number | null;
  /** pes de la població de nacionalitat estrangera, en percentatge */
  pe?: number | null;
  /** preu de l'aigua: el tram de subministrament, en euros per metre cúbic */
  pa?: number | null;
  /**
   * Renda neta mitjana per persona, en euros l'any, i de quin any és.
   *
   * És l'Atles de distribució de renda de les llars de l'INE (kind «riquesa»,
   * J23), i és la dada que faltava per poder comparar pobles de debò: fins ara
   * aquesta llista deia qui hi mana i què deu l'ajuntament, i no deia res de
   * quants diners hi entren a casa. La xifra és neta —després d'impostos i
   * cotitzacions— i repartida entre tots els membres de la llar, que és la que
   * la gent entén; per ordenar municipis, J23 recomana la mediana per unitat de
   * consum, i qui la vulgui la té sencera a la fitxa del municipi.
   *
   * **Això no ho decideix l'ajuntament.** Quant guanya la gent d'un poble
   * depèn de qui hi viu i de què hi treballa, no del ple; el que sí que decideix
   * el ple és quines taxes cobra i a qui les bonifica. La pàgina ho ha de dir al
   * costat de la xifra, com ja fa amb el deute.
   *
   * L'any va a cada fila i no a la pàgina perquè un municipi sense la xifra de
   * l'any bo no ha de fer semblar que la llista sencera és d'un altre any.
   */
  rn?: number | null;
  ra?: number | null;
};

/**
 * Les mètriques que la llista dels 947 llegeix, i cap més.
 *
 * Demanar-ne una que no hi és no falla: `own?.has(...)` torna fals i la columna
 * surt buida sense dir res. Va passar amb `singleList`, que no hi era: el
 * comptador de la portada dels 947 deia que cap municipi no té una sola
 * candidatura al ple quan el Síndic n'hi compta **185**, i el filtre no trobava
 * res. La llista de dalt s'ha de mirar cada cop que la fila creixi.
 *
 * Aquí hi havia també `"actes"`, que cap job no escriu —J12 i J16 desen
 * `mocions`— i que aquí no caldria igualment: les actes indexades surten de
 * `municipalities.minutesCount`, no de cap mètrica.
 */
const KINDS_ELS947: string[] = [
  // «carrecs» hi és només per una cosa: el retrat de l'alcaldia. Són 5 kB per
  // municipi —uns 4,7 MB en total— i `carregaMetriques` ja els demana en blocs
  // de 200, que és el que fa que això no repeteixi el problema de memòria de
  // les actes. Si un dia aquesta mètrica creix, el primer que s'ha de mirar és
  // si val la pena continuar-la llegint aquí per una sola imatge.
  "carrecs",
  "electoralHistory",
  "finances",
  "government",
  "mayors",
  "parity",
  "transparency",
  "results",
  "singleList",
  // Aquestes dues només serveixen per al mapa, i s'hi han posat sabent què
  // costen: «poblacio» porta la sèrie sencera de cada indicador de l'Idescat i
  // «preuAigua» la de cada any del full de l'ACA. D'aquí en surt una xifra de
  // cadascuna —el pes de la població de nacionalitat estrangera i el preu del
  // subministrament— i la resta es llegeix i es llença. Si un dia la memòria
  // torna a petar, aquest és el primer lloc per mirar: el que caldria és una
  // consulta que demanés només el camp, no la mètrica sencera.
  "poblacio",
  "preuAigua",
  // La renda. Aquesta mètrica porta els sis indicadors de l'ADRH amb la sèrie
  // sencera del 2015 al 2023 i la comparació amb Catalunya: d'aquí només en
  // surten dues xifres —el valor de la renda neta per persona i el seu any— i
  // la resta es llegeix i es llença, igual que passa amb «poblacio». Quant
  // pesa no s'ha pogut mesurar: J23 encara no s'ha passat sobre la base amb
  // què s'ha fet aquesta feina. Si la memòria del motor torna a petar,
  // aquesta i «poblacio» són les dues primeres a mirar, i el que caldria és
  // una consulta que demanés el camp i no la mètrica sencera.
  "riquesa",
];

/**
 * Llegir una mètrica **només** si s'ha demanat a la consulta.
 *
 * Sense això, demanar una clau que no és a `KINDS_ELS947` torna `undefined` i
 * la columna surt buida per als 947 sense dir-ho enlloc. És com el comptador de
 * plens amb una sola candidatura va estar dient 0 quan n'hi ha 185: no fallava
 * res, simplement no s'havia demanat. Ara peta, i peta a la primera fila.
 */
export function lectorDe(own: Map<string, unknown> | undefined): {
  llegeix: (kind: string) => unknown;
  te: (kind: string) => boolean;
} {
  const comprova = (kind: string): void => {
    if (!KINDS_ELS947.includes(kind)) {
      throw new Error(`els947 llegeix la mètrica «${kind}» i no la demana: afegeix-la a KINDS_ELS947`);
    }
  };
  return {
    llegeix: (kind) => {
      comprova(kind);
      return own?.get(kind);
    },
    te: (kind) => {
      comprova(kind);
      return own?.has(kind) ?? false;
    },
  };
}

/**
 * La clau d'una candidatura: el municipi i les seves sigles.
 *
 * Existeix perquè el separador es decidia dues vegades i no coincidien. El
 * mapa es construïa amb un byte nul enmig —escrit cru dins del fitxer, on no es
 * veu— i es llegia amb un espai, i per tant **no encertava mai**: 0 de 947. El
 * codi d'agrupació electoral, que és el que la Generalitat diu i que no s'ha
 * d'endevinar, no s'arribava a fer servir en cap municipi i tot ho decidia
 * `siglesFamily()` sobre l'acrònim.
 *
 * Amb la clau bona, 706 dels 947 tenen codi d'agrupació i la marca de
 * l'alcaldia canvia a **12 municipis**: a Calaf «JxC-AM» constava de Junts i el
 * codi diu que és d'ERC; al Prat de Llobregat «EPCP-C» no tenia marca i és dels
 * comuns —l'exemple que aquest mateix fitxer ja tenia escrit com a motiu de
 * fer-ho pel codi—; i dotze pastilles de la llista enllaçaven al partit que no
 * era o no enllaçaven.
 *
 * El separador continua sent un byte nul, que és bona tria —no pot sortir mai
 * dins d'unes sigles—, però ara s'escriu **una sola vegada i com a escapada**.
 * Cru, `grep` veia el fitxer com a binari i no hi trobava res: buscar-hi la
 * clau per assegurar-se que les dues bandes coincidien tornava zero línies, i
 * aquesta és la meitat de per què això va sobreviure tant de temps.
 */
export function clauCandidatura(municipalityId: number, sigles: string): string {
  return `${municipalityId}\u0000${sigles}`;
}

export async function loadEls947(db: Db): Promise<Els947Row[]> {
  const all = await db.select().from(municipalities);
  /**
   * Les mètriques, només les que calen i **de tros en tros**.
   *
   * Aquesta consulta portava la taula sencera. Quan J12 hi va afegir els punts
   * votats de les actes —41.113 punts amb el seu text i el vot de cada grup, 18
   * MB en 67 files— el motor de WebAssembly de PGlite es quedava sense memòria
   * («memory access out of bounds») i la publicació sencera fallava abans de
   * generar res, per una columna que aquí no es mira mai.
   *
   * Filtrar per tipus no n'hi havia prou: només la liquidació ja són 8 MB, i el
   * resultat sencer ha de cabre a la memòria del motor d'una tirada. Es demana
   * en blocs, que és el que fa que això aguanti quan la base de dades creixi
   * —i creixerà, perquè les actes són el que més té per créixer.
   */
  const metrics = await carregaMetriques(db, KINDS_ELS947);

  const byMunicipality = new Map<number, Map<string, unknown>>();
  for (const metric of metrics) {
    let map = byMunicipality.get(metric.municipalityId);
    if (!map) byMunicipality.set(metric.municipalityId, (map = new Map()));
    map.set(metric.kind, metric.data);
  }

  /**
   * De quina marca és cada candidatura, segons el codi d'agrupació electoral.
   *
   * La clau és el municipi **i** les sigles, mai les sigles soles: «Junts per
   * Sabadell» i «Junts per Girona» són dues candidatures diferents, i hi ha
   * sigles curtes —«CM», «AM», «UP»— que es repeteixen a pobles que no tenen
   * res a veure. És la mateixa clau que fa servir la pàgina de comarca.
   */
  const candidatureRows = await db
    .select({
      municipalityId: candidatures.municipalityId,
      sigles: candidatures.sigles,
      brandId: candidatures.brandId,
    })
    .from(candidatures)
    .where(eq(candidatures.electionId, "M20231"));
  const brandBySigles = new Map(
    candidatureRows.map((r) => [clauCandidatura(r.municipalityId, r.sigles), r.brandId]),
  );

  // La participació del 2023. No és cap mètrica derivada: són el cens i els
  // votants tal com els publica la Generalitat, i es divideixen aquí.
  const turnoutRows = await db
    .select({
      municipalityId: electionParticipation.municipalityId,
      censusSize: electionParticipation.censusSize,
      voters: electionParticipation.voters,
    })
    .from(electionParticipation)
    .where(eq(electionParticipation.electionId, "M20231"));
  const participacio = new Map<number, number>();
  for (const row of turnoutRows) {
    if (!row.censusSize || row.voters === null) continue;
    participacio.set(row.municipalityId, Math.round((10_000 * row.voters) / row.censusSize) / 100);
  }

  return all
    .map((m): Els947Row => {
      const own = byMunicipality.get(m.id);
      const { llegeix, te } = lectorDe(own);
      const government = llegeix("government") as
        | { winnerGoverns: boolean | null; winnerHasMajority: boolean; mayorSigles: string | null }
        | undefined;
      const mayors = llegeix("mayors") as { currentTermChange: unknown } | undefined;
      const parity = llegeix("parity") as { womenElectedPct: number | null; complet?: boolean } | undefined;
      const history = llegeix("electoralHistory") as { alternances: number; elections: number } | undefined;
      const transparency = llegeix("transparency") as { pct: number | null } | undefined;
      const finances = llegeix("finances") as
        | { indicators: { key: string; value: number | null }[] }
        | undefined;
      const indicator = (key: string): number | null =>
        finances?.indicators.find((i) => i.key === key)?.value ?? null;

      // El retrat de qui té l'alcaldia. S'aparella pel càrrec i no pel nom:
      // la seu electrònica escriu «Alcalde», «Alcaldessa» o «Alcaldia» i això
      // és més estable que el nom, que cada font escriu a la seva manera.
      const carrecs = llegeix("carrecs") as
        | { carrecs: { nom: string; carrec: string; fotoPetita: string | null }[] }
        | undefined;
      const capDeCasa = carrecs?.carrecs.find((c) => /alcald/i.test(c.carrec)) ?? null;
      const sigles = government?.mayorSigles ?? m.mayorPartyRaw ?? null;
      const familia = sigles ? siglesFamily(sigles) : null;

      /*
       * La marca de l'alcaldia, primer per codi d'agrupació i després per
       * sigles. «local» compta com a no saber-ho: és alhora la marca de les
       * agrupacions d'electors i la casella on cau tot el que no és a la taula
       * de codis, i tractar-la com una negació hauria despintat Tiana, on la
       * llista es diu «JUNTS» i el codi encara no s'ha repassat.
       */
      const marcaAgrupacio = sigles ? brandBySigles.get(clauCandidatura(m.id, sigles)) ?? null : null;
      const marca = marcaAgrupacio && marcaAgrupacio !== "local" ? marcaAgrupacio : familia;

      const poblacio = llegeix("poblacio") as
        | { indicadors: { clau: string; valor: number | null }[] }
        | undefined;
      const aigua = llegeix("preuAigua") as
        | { preu: { subministrament: number | null } }
        | undefined;

      /*
       * La renda de la gent que hi viu, de l'Atles de l'INE.
       *
       * Es busca l'indicador per la clau i no per la posició de la llista: J23
       * en desa sis i l'ordre és cosa seva. `darrerAnyPropi` no s'agafa a
       * posta: si un municipi no té la xifra de l'any bo, aquí surt buit i no
       * una xifra vella barrejada amb les dels altres, que és el que faria que
       * ordenar la llista per renda comparés anys diferents.
       */
      const riquesa = llegeix("riquesa") as
        | { any: number | null; indicadors: { clau: string; valor: number | null }[] }
        | undefined;
      const renda =
        riquesa?.indicadors?.find((i) => i.clau === "rendaNetaPersona")?.valor ?? null;

      return {
        s: m.slug,
        n: m.name,
        c: m.comarca ?? "",
        p: m.population ?? 0,
        r: government ? (government as unknown as { totalSeats: number }).totalSeats : (m.councilSeats ?? 0),
        a: m.mayorName,
        g: sigles,
        ar: capDeCasa?.fotoPetita ?? null,
        ac: marca ? BRANDS_BY_ID.get(marca)?.color ?? null : null,
        w: government?.winnerGoverns === null || government === undefined ? null : government.winnerGoverns ? 1 : 0,
        m: government?.winnerHasMajority ? 1 : 0,
        k: mayors?.currentTermChange ? 1 : 0,
        t: m.minutesCount ?? 0,
        d: indicator("deute-habitant"),
        e: indicator("estalvi-net"),
        f: parity?.complet === false ? null : parity?.womenElectedPct ?? null,
        v: history?.alternances ?? null,
        q: history?.elections ?? null,
        y: transparency?.pct ?? null,
        o: te("singleList") ? 1 : 0,
        b: marca,
        pt: participacio.get(m.id) ?? null,
        pe: poblacio?.indicadors?.find((i) => i.clau === "pctNacionalitatEstrangera")?.valor ?? null,
        pa: aigua?.preu?.subministrament ?? null,
        rn: renda,
        ra: renda === null ? null : riquesa?.any ?? null,
      };
    })
    .sort((a, b) => b.p - a.p);
}

const escape = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Una fila amb el que la pàgina hi afegeix: si el municipi ja té radiografia. */
export type Fila = Els947Row & { x: 0 | 1 };

/**
 * La normalització de la cerca.
 *
 * Es fa servir dos cops: aquí per escriure la clau de cada fila a l'HTML, i al
 * navegador per normalitzar el que s'escriu. Va serialitzada amb `toString()` i
 * no copiada, perquè no hi pugui haver mai dues versions que es desincronitzin:
 * que un municipi no es trobés escrivint el seu propi nom seria l'error més
 * ridícul possible en una llista que es diu «els 947».
 */
export function clauCerca(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/^(l|el|la|els|les|es|sa)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** La mediana d'una llista de xifres, o `null` si no n'hi ha cap. */
export function mediana(valors: readonly number[]): number | null {
  const nets = valors.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (nets.length === 0) return null;
  const mig = Math.floor(nets.length / 2);
  return nets.length % 2 === 1 ? nets[mig]! : (nets[mig - 1]! + nets[mig]!) / 2;
}

/**
 * Els dos llindars que es calculen del conjunt i no vénen de cap font.
 *
 * Són medianes, i van arrodonides perquè l'etiqueta del filtre digui exactament
 * la regla que s'aplica: si el botó diu «per sobre de 1.204 €», el que filtra ha
 * de ser 1.204 i no 1.203,5. També hi va quants municipis tenen la dada: amb
 * quatre no té sentit oferir cap mediana, i el filtre desapareix.
 */
export type Llindars = {
  deute: number | null;
  transparencia: number | null;
  ambDeute: number;
  ambTransparencia: number;
  /**
   * La renda neta per persona del municipi que queda al mig.
   *
   * L'INE tapa per secret estadístic la renda dels municipis més petits, i per
   * això la mediana es fa **només amb els que en tenen** i es diu quants són:
   * si es comptessin els forats com a zero, la mitja Catalunya de muntanya
   * arrossegaria el llindar cap avall i el filtre diria una cosa falsa.
   */
  renda: number | null;
  ambRenda: number;
};

/** Per sota d'això, una mediana diu més del forat de dades que dels municipis. */
const MINIM_PER_A_MEDIANA = 40;

export function llindarsDe(files: readonly Els947Row[]): Llindars {
  const deutes = files.map((f) => f.d).filter((v): v is number => v !== null);
  const transparencies = files.map((f) => f.y).filter((v): v is number => v !== null);
  const rendes = files.map((f) => f.rn ?? null).filter((v): v is number => v !== null);
  const arrodoneix = (v: number | null): number | null => (v === null ? null : Math.round(v));
  return {
    deute: deutes.length >= MINIM_PER_A_MEDIANA ? arrodoneix(mediana(deutes)) : null,
    transparencia:
      transparencies.length >= MINIM_PER_A_MEDIANA ? arrodoneix(mediana(transparencies)) : null,
    ambDeute: deutes.length,
    ambTransparencia: transparencies.length,
    renda: rendes.length >= MINIM_PER_A_MEDIANA ? arrodoneix(mediana(rendes)) : null,
    ambRenda: rendes.length,
  };
}

const xifra = (n: number): string => n.toLocaleString("ca-ES");

/**
 * Els filtres, agrupats per la pregunta que responen.
 *
 * Cap filtre no diu si el que troba està bé o malament: «deute per sobre de la
 * mediana» és una posició dins dels 947, no una nota de gestió. Els quatre
 * últims (dones al ple, deute, transparència i mida) són camps que ja hi eren a
 * cada fila i que no es podien filtrar: la pàgina els ensenyava i no deixava
 * preguntar-los, que és la manera més segura de tenir una dada que no serveix.
 */
type GrupFiltres = { clau: string; titol: string; tema: string };

const GRUPS_FILTRE: readonly GrupFiltres[] = [
  { clau: "mana", titol: "Qui hi mana", tema: "participació" },
  { clau: "ple", titol: "Com és el ple", tema: "el ple" },
  { clau: "papers", titol: "Els comptes i els papers", tema: "fiscalitat" },
  { clau: "municipi", titol: "Quin municipi", tema: "urbanisme" },
];

type Filtre = {
  clau: string;
  grup: string;
  text: (l: Llindars) => string;
  te: (f: Fila, l: Llindars) => boolean;
  /** Si el conjunt no dóna per a aquest filtre, no es dibuixa. */
  hi?: (l: Llindars) => boolean;
};

export const FILTRES: readonly Filtre[] = [
  { clau: "pacte", grup: "mana", text: () => "Governa qui no va guanyar", te: (f) => f.w === 0 },
  { clau: "canvi", grup: "mana", text: () => "Canvi d'alcaldia a mig mandat", te: (f) => f.k === 1 },
  {
    clau: "sempre",
    grup: "mana",
    text: () => "La mateixa força des del 1979",
    te: (f) => f.v === 0 && (f.q ?? 0) >= 8,
  },
  { clau: "majoria", grup: "ple", text: () => "Majoria absoluta", te: (f) => f.m === 1 },
  { clau: "unica", grup: "ple", text: () => "Una sola candidatura", te: (f) => f.o === 1 },
  {
    clau: "dones",
    grup: "ple",
    text: () => "Més dones que homes al ple",
    te: (f) => f.f !== null && f.f > 50,
  },
  {
    clau: "deute",
    grup: "papers",
    text: (l) => `Deute per sobre de ${xifra(l.deute ?? 0)} €`,
    te: (f, l) => l.deute !== null && f.d !== null && f.d > l.deute,
    hi: (l) => l.deute !== null,
  },
  {
    clau: "opac",
    grup: "papers",
    text: (l) => `Transparència per sota del ${xifra(l.transparencia ?? 0)} %`,
    te: (f, l) => l.transparencia !== null && f.y !== null && f.y < l.transparencia,
    hi: (l) => l.transparencia !== null,
  },
  { clau: "sense", grup: "papers", text: () => "Sense cap acta del ple", te: (f) => f.t === 0 },
  /*
   * La renda va a «Quin municipi» i no a «Els comptes i els papers» a posta:
   * no és un compte de l'ajuntament sinó el context en què governa, i posar-la
   * al costat del deute la faria llegir com una nota de gestió. El text diu
   * «hi entra menys» i no «és més pobre»: la xifra és una posició dins dels
   * 947, i qui hi viu no ha de rebre cap adjectiu d'aquesta pàgina.
   */
  {
    clau: "renda",
    grup: "municipi",
    text: (l) => `Hi entra menys de ${xifra(l.renda ?? 0)} € per persona`,
    te: (f, l) => l.renda !== null && (f.rn ?? null) !== null && f.rn! < l.renda,
    hi: (l) => l.renda !== null,
  },
  { clau: "petits", grup: "municipi", text: () => "Menys de 1.000 habitants", te: (f) => f.p < 1000 },
  { clau: "fitxa", grup: "municipi", text: () => "Amb radiografia", te: (f) => f.x === 1 },
];

/** Els filtres que aquest conjunt de dades permet oferir. */
export function filtresDisponibles(l: Llindars): readonly Filtre[] {
  return FILTRES.filter((f) => (f.hi ? f.hi(l) : true));
}

/** Les marques d'una fila: el que el filtre de CSS busca amb `[data-f~=…]`. */
export function marques(fila: Fila, l: Llindars): string[] {
  return filtresDisponibles(l)
    .filter((f) => f.te(fila, l))
    .map((f) => f.clau);
}

/** Les pastilles d'una fila, en l'ordre en què es llegeixen. */
export function pastilles(fila: Fila, l: Llindars): string[] {
  const out: string[] = [];
  const posa = (text: string, mena = ""): number =>
    out.push(`<span class="pastilla${mena ? ` ${mena}` : ""}">${escape(text)}</span>`);

  if (fila.w === 0) posa("Governa qui no va guanyar", "pacte");
  if (fila.k === 1) posa("Canvi d'alcaldia a mig mandat", "canvi");
  if (fila.m === 1) posa("Majoria absoluta", "majoria");
  if (fila.o === 1) posa("Una sola candidatura", "unica");
  if (fila.v === 0 && (fila.q ?? 0) >= 8) posa("La mateixa força des del 1979", "sempre");
  else if (fila.v !== null && fila.q !== null)
    posa(`${fila.v} canvis de mans en ${fila.q} eleccions`);
  // El nom de l'alcaldia i les seves sigles ja tenen la seva pròpia línia amb
  // la cara i el color: com a pastilles hi sortien una segona vegada, en text
  // pla i barrejades amb les xifres del poble.
  posa(`${fila.r} regidories`);
  posa(fila.t > 0 ? `${xifra(fila.t)} actes indexades` : "Sense actes", fila.t > 0 ? "" : "sense");
  if (fila.d !== null) posa(`${xifra(fila.d)} € de deute per habitant`);
  // La renda porta l'any perquè no és la de tothom el mateix any: l'INE tapa la
  // dels municipis petits i uns quants es queden amb la de fa un any o dos.
  if ((fila.rn ?? null) !== null)
    posa(
      fila.ra
        ? `${xifra(fila.rn!)} € de renda per persona (${fila.ra})`
        : `${xifra(fila.rn!)} € de renda per persona`,
    );
  if (fila.f !== null) posa(`${xifra(fila.f)} % de dones al ple`);
  if (fila.y !== null) posa(`Transparència ${xifra(fila.y)} %`);
  return out;
}

/**
 * Per què es pot ordenar la llista.
 *
 * Una llista de 947 files ordenada sempre igual només respon una pregunta: qui
 * és més gran. Totes les altres xifres hi eren escrites i no es podien fer
 * servir per posar ningú en ordre, i «quin poble deu més per habitant» o «on hi
 * entren menys diners a casa» eren respostes que la pàgina tenia i no donava.
 *
 * D'on surt cada xifra importa pel pes de la pàgina, que ja és gran: **la que
 * no cal escriure, no s'escriu**. El nom ja va a `data-k`, que és la clau de
 * cerca. I la població no va enlloc, perquè l'ordre en què la llista ja ve
 * escrita **és** de més població a menys: ordenar-la per població és tornar a
 * l'ordre de sortida. Només les cinc que no es poden deduir de res viatgen a
 * `data-o`; escriure-hi també la població eren 4,3 kB més de pàgina —2,7 un
 * cop comprimida— per no dir res de nou.
 *
 * **Cap ordre no és un rànquing de gestió.** «De més deute a menys» diu on cau
 * cada municipi, no qui ho fa millor: la pàgina ja ho diu de les medianes i
 * s'aplica igual aquí. I qui no té la dada va sempre al final, tant si
 * s'ordena de més a menys com al revés: un forat no és un zero, i posar-lo
 * entre els que menys tenen seria inventar-se una xifra.
 */
export type Ordre = {
  clau: string;
  text: string;
  /**
   * D'on surt la xifra: de l'ordre en què la pàgina ja ve escrita, del nom
   * —que ja és a «data-k»— o d'una posició de «data-o».
   */
  de: "escrit" | "nom" | "xifra";
  /** La posició dins de «data-o», només quan surt d'allà. */
  i?: number;
  /**
   * D'on surt la xifra a la fila, quan surt de «data-o».
   *
   * Escriure `data-o` i llegir-lo eren dues llistes que s'havien de mantenir
   * iguals a mà, i el dia que algú n'afegís una al mig, ordenar per dones al
   * ple hauria ordenat per actes sense petar enlloc. Amb això només n'hi ha
   * una: `clausOrdre()` escriu el que digui aquesta funció, en aquest ordre.
   */
  val?: (fila: Fila) => number | null | undefined;
  /** Si de primeres es llegeix de més a menys. */
  gran: boolean;
  /** Com es diu l'ordre al recompte, en cada sentit. */
  avall: string;
  amunt: string;
};

export const ORDRES: readonly Ordre[] = [
  { clau: "pob", text: "Població", de: "escrit", gran: true,
    avall: "dels més grans als més petits", amunt: "dels més petits als més grans" },
  { clau: "nom", text: "Nom", de: "nom", gran: false,
    avall: "per ordre alfabètic", amunt: "per ordre alfabètic invers" },
  { clau: "renda", text: "Renda per persona", de: "xifra", i: 0, val: (f) => f.rn, gran: true,
    avall: "de més renda per persona a menys", amunt: "de menys renda per persona a més" },
  { clau: "deute", text: "Deute per habitant", de: "xifra", i: 1, val: (f) => f.d, gran: true,
    avall: "de més deute per habitant a menys", amunt: "de menys deute per habitant a més" },
  { clau: "transp", text: "Transparència", de: "xifra", i: 2, val: (f) => f.y, gran: true,
    avall: "de més compliment del portal de transparència a menys",
    amunt: "de menys compliment del portal de transparència a més" },
  { clau: "dones", text: "Dones al ple", de: "xifra", i: 3, val: (f) => f.f, gran: true,
    avall: "de més dones al ple a menys", amunt: "de menys dones al ple a més" },
  { clau: "actes", text: "Actes indexades", de: "xifra", i: 4, val: (f) => f.t, gran: true,
    avall: "de més actes indexades a menys", amunt: "de menys actes indexades a més" },
];

/** Les que viatgen a «data-o», en l'ordre exacte en què s'hi escriuen. */
const XIFRES_ORDRE: readonly Ordre[] = ORDRES.filter((o) => o.de === "xifra").slice()
  .sort((a, b) => (a.i ?? 0) - (b.i ?? 0));

/**
 * Els ordres que aquest conjunt permet oferir.
 *
 * Un botó «Renda per persona» en una llista on ningú no té la renda ordenaria
 * 947 buits i deixaria la pàgina igual dient «de més renda a menys»: seria una
 * pàgina que menteix sobre el que sap. Passa de debò cada cop que J23 encara no
 * s'ha passat, i és el mateix criteri que ja s'aplica als filtres.
 */
export function ordresDisponibles(files: readonly Fila[]): readonly Ordre[] {
  return ORDRES.filter(
    (o) => o.de !== "xifra" || files.some((f) => (o.val?.(f) ?? null) !== null),
  );
}

/**
 * Les xifres d'una fila que es poden ordenar, en una sola cadena.
 *
 * Van totes juntes i separades per barres perquè cinc atributs `data-` per
 * fila són 4.735 atributs a la pàgina; així n'és un. El buit és la cadena
 * buida i **no** un zero, que és el que fa que un municipi sense la dada es
 * pugui enviar al final en comptes de fer-lo passar per pobre o per net de
 * deute.
 *
 * La població no hi és: la llista ja ve escrita de més gran a més petit i
 * l'ordre de sortida és exactament aquest.
 */
export function clausOrdre(fila: Fila): string {
  return XIFRES_ORDRE.map((o) => {
    const v = o.val?.(fila) ?? null;
    return v === null ? "" : String(v);
  }).join("|");
}

/**
 * El CSS propi. Tota la resta —tipografies, colors, capçalera, `.destins`,
 * `.bloc`, `.index`— surt de `RADIOGRAFIA_CSS`, que és el que fa que aquesta
 * pàgina rebi les correccions de la resta de l'Observatori en comptes de
 * quedar-se amb una còpia vella dels mateixos estils.
 */
const CSS = `
.xifres{list-style:none;display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  margin:var(--e4) 0 0;padding:0}
.xifres li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2)}
.xifres b{display:block;font-family:var(--display);font-weight:900;font-size:2.1rem;line-height:1;
  letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.xifres span{font-size:.82rem;color:var(--ink-suau)}
.pistes{display:flex;flex-wrap:wrap;gap:8px;margin:var(--e3) 0 0}

/* --- qui mana a cada poble, a la llista dels 947 -------------------------
   Amb 947 files, un nom i unes sigles en text pla es llegeixen d'una en una.
   La cara i el color de la força es recullen d'una passada, que és el que fa
   que la llista es pugui recórrer. Sense fotografia hi van les inicials amb el
   color del partit: mai un buit, que faria semblar que d'aquell poble no en
   sabem qui mana quan el que passa és que l'ajuntament no en publica el retrat. */
.mana{display:flex;align-items:center;gap:9px;margin:6px 0 0;flex-wrap:wrap}
.mana .cara{width:30px;height:30px;border-radius:50%;object-fit:cover;object-position:50% 22%;
  border:2px solid var(--ink);background:var(--paper-2);flex:none}
.mana .cara.inicials{display:flex;align-items:center;justify-content:center;font-family:var(--display);
  font-weight:900;font-size:.72rem;background:var(--c);color:var(--t)}
.mana .qui-mana{font-weight:800;font-size:.9rem;min-width:0;overflow-wrap:anywhere}
/* La pastilla de sigles, i el «nowrap» que desplaçava la pàgina sencera.
   «.sigla» de RADIOGRAFIA_CSS porta «white-space:nowrap», i té raó de portar-lo
   allà: dins d'una frase de titular, «PSC-CP» partit en dues ratlles no es
   llegeix. Aquí no: les sigles de la llista són les de la candidatura sencera,
   i n'hi ha de 63 caràcters —«VIU SORIGUERA-ESQUERRA REPUBLICANA DE
   CATALUNYA-ACORD MUNICIPAL»— que amb «nowrap» fan 498 px. En un mòbil de 320
   això feia un document de 522 px: la pàgina sencera es desplaçava de costat i
   el títol i la capçalera se n'anaven amb ella. Ara la pastilla es parteix, com
   ja fan «.pastilla» i el nom del municipi d'aquesta mateixa fila.
   El «max-width» és el cinturó: si un dia arriba una paraula sola més llarga
   que la pantalla, es queda dins de la seva fila i no mou res més. */
.mana .sigla{font-size:.72rem;padding:0 9px;white-space:normal;overflow-wrap:anywhere;
  max-width:100%;min-width:0;text-align:center;
  display:inline-flex;align-items:center;min-height:30px;
  text-decoration:none;position:relative}
/* L'objectiu de toc, sense fer la fila més alta. La pastilla fa 30 px per
   quadrar amb la cara del costat; els 44 que demana un dit els posa aquesta
   caixa invisible, que creix sobre l'espai que la fila ja té buit i no
   desplaça res.
   Creix 4 amunt i 10 avall i no 7 i 7 a posta: amb 7 amunt la caixa entrava
   1 px dins de l'enllaç de la comarca, que és la línia de sobre i també es
   toca, i un dit a la vora hauria obert el partit volent obrir la comarca.
   Avall no hi ha res per prendre: les pastilles de xifres no són enllaços. */
.mana a.sigla::after{content:"";position:absolute;inset:-4px -2px -10px}
.mana a.sigla:hover,.mana a.sigla:focus-visible{text-decoration:underline;
  text-decoration-thickness:2px;text-underline-offset:2px}
.mana a.sigla:focus-visible{outline:3px solid var(--coral);outline-offset:2px}

/* --- el tauler: cercador, filtres i llista ---------------------------- */
.tauler{margin:var(--e4) 0 0}
.cercador{position:sticky;top:0;z-index:5;background:var(--paper);padding:var(--e2) 0;
  border-bottom:2.5px solid var(--ink)}
/* El cercador és l'única peça que necessita JavaScript: sense ell no faria res
   i seria un camp que enganya. Els filtres, en canvi, són caselles i CSS. */
.cercador{display:none}
.js .cercador{display:block}
#cerca{width:100%;font:inherit;font-size:1.1rem;padding:13px 16px;border:2.5px solid var(--ink);
  border-radius:var(--r-m);background:var(--paper-2);color:var(--ink);box-shadow:var(--ombra)}

.filtres{margin:var(--e3) 0 0}
.colla{margin:0 0 var(--e2)}
.colla h3{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-family:var(--text);
  font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-suau)}
.colla h3 .icona{width:26px;height:26px}
.tries{display:flex;flex-wrap:wrap;gap:8px}
.filtre{display:inline-flex;align-items:center;min-height:44px;padding:0 15px;font-size:.82rem;
  font-weight:800;border:2px solid var(--ink);border-radius:var(--r-max);cursor:pointer;
  overflow-wrap:anywhere}
.commutador:checked+.filtre{background:var(--ink);color:var(--paper)}
.commutador:focus-visible+.filtre{outline:3px solid var(--coral);outline-offset:2px}
.eines{display:flex;flex-wrap:wrap;align-items:center;gap:var(--e2);margin:var(--e2) 0 0}
.neteja{font:inherit;font-size:.82rem;font-weight:800;display:inline-flex;align-items:center;
  min-height:44px;padding:0 15px;border:2px dashed var(--ink);border-radius:var(--r-max);
  background:transparent;color:inherit;cursor:pointer}
.recompte{font-size:.86rem;color:var(--ink-suau);margin:0}

/* --- quants en queden, a cada casella --------------------------------
   Un filtre que no diu quants en troba fa jugar a les endevinalles: es marca,
   es compta el que ha quedat i es torna a desmarcar. La xifra és quants dels
   que ara es veuen porten aquella marca, i per això canvia amb la cerca i amb
   la resta de filtres: marcar-lo deixarà exactament aquests. Va entre parèntesis
   i en tabular perquè no ballin els botons a cada lletra que s'escriu. */
.quants{font-variant-numeric:tabular-nums;font-weight:700;opacity:.72;margin-left:7px}
.commutador:checked+.filtre .quants{opacity:.85}
/* Sense JavaScript la xifra no existeix, i un parèntesi buit al costat de cada
   filtre seria pitjor que no dir res. */
.quants{display:none}
.js .quants{display:inline}

/* --- per què s'ordena, i quina mana -----------------------------------
   Els botons són camps de ràdio: només un pot manar alhora i el navegador ja
   ho fa complir sol, sense cap línia de JavaScript que hi vigili. El que mana
   es veu igual que un filtre marcat —fons de tinta, lletra de paper— perquè
   la pàgina ja ensenya així «això està actiu» i no cal aprendre-ho dues vegades. */
.ordre{margin:var(--e3) 0 0;display:none}
.js .ordre{display:block}
.ordre .tries{align-items:center}
.capgira{font:inherit;font-size:.82rem;font-weight:800;display:inline-flex;align-items:center;gap:7px;
  min-height:44px;padding:0 15px;border:2px dashed var(--ink);border-radius:var(--r-max);
  background:transparent;color:inherit;cursor:pointer}
.capgira:focus-visible{outline:3px solid var(--coral);outline-offset:2px}
.capgira .fletxa{font-size:.9rem;line-height:1}

.llista{list-style:none;margin:var(--e2) 0 0;padding:0}
.fila{border-bottom:1px solid var(--vora);padding:2px 0 var(--e2);min-width:0}
.fila .titol{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 var(--e2);margin:0}
.fila .municipi{display:inline-flex;align-items:center;min-height:44px;font-family:var(--display);
  font-weight:900;font-size:1.15rem;letter-spacing:-.02em;text-decoration:none;overflow-wrap:anywhere}
.fila a.municipi{border-bottom:2.5px solid var(--coral)}
.fila .pob{font-size:.9rem;font-weight:800;color:var(--ink-suau);font-variant-numeric:tabular-nums;
  margin-left:auto}
.fila .lloc{margin:0;font-size:.82rem;color:var(--ink-suau)}
.fila .lloc a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none;
  border-bottom:1.5px solid var(--vora)}
/* Una pastilla com «Josep Maria Gras Charles» o «AGRUPACIÓ D'ELECTORS-PROGRÉS
   MUNICIPAL» feia 453 px amb «white-space:nowrap» i desplaçava la pàgina
   sencera de costat en un mòbil de 320. Aquí no hi ha cap «nowrap»: el nom i
   les sigles van en pastilles separades i totes dues es poden partir. */
.fila .dades{display:flex;flex-wrap:wrap;gap:6px;margin:var(--e1) 0 0;min-width:0}
.pastilla{font-size:.72rem;font-weight:700;line-height:1.4;border:1.5px solid var(--vora);
  border-radius:var(--r-max);padding:3px 10px;max-width:100%;min-width:0;overflow-wrap:anywhere}
.pastilla.pacte{background:var(--presec);border-color:var(--ink);color:#1E1B2E}
.pastilla.canvi{background:var(--lavanda);border-color:var(--ink);color:#1E1B2E}
.pastilla.majoria{background:var(--menta);border-color:var(--ink);color:#1E1B2E}
.pastilla.sempre{background:var(--coral);border-color:var(--ink);color:#1E1B2E}
.pastilla.unica{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.pastilla.sigles{border-color:var(--ink);font-weight:900}
.pastilla.sense{border-style:dashed;color:var(--ink-suau)}
.buit{padding:var(--e4) 0;color:var(--ink-suau)}
.fila.fora{display:none}

/* Les 43 comarques reaprofiten les pastilles de l'índex de la fitxa, però aquí
   van dins d'un bloc que ja porta la seva ratlla: dues de seguides es llegien
   com una separació doble. */
.bloc .index{border-top:0;margin-top:var(--e2);padding-top:0}

/* --- els filtres, sense JavaScript ------------------------------------
   Cada casella amaga les files que no porten la seva marca. Ho fa el navegador
   amb «:has()»; si algun no el sap fer, no passa res greu: la llista es queda
   sencera i llegible, que és el mínim que aquesta pàgina ha de complir sempre. */
${FILTRES.map(
  (f) =>
    `.tauler:has(#f-${f.clau}:checked) .fila:not([data-f~="${f.clau}"]){display:none}`,
).join("\n")}
`;

export function renderEls947(
  rows: readonly Els947Row[],
  generatedAt: string,
  withPage: ReadonlySet<string>,
): string {
  const files: Fila[] = rows.map((r) => ({ ...r, x: withPage.has(r.s) ? 1 : 0 }));
  const llindars = llindarsDe(rows);
  const disponibles = filtresDisponibles(llindars);
  // Un ordre només s'ofereix si algú té la xifra: vegeu «ordresDisponibles».
  const ordres = ordresDisponibles(files);

  const totals = {
    municipis: files.length,
    regidories: files.reduce((a, r) => a + r.r, 0),
    pacte: files.filter((r) => r.w === 0).length,
    majoria: files.filter((r) => r.m === 1).length,
    canvis: files.filter((r) => r.k === 1).length,
    sempre: files.filter((r) => r.v === 0 && (r.q ?? 0) >= 8).length,
    senseOposicio: files.filter((r) => r.o === 1).length,
    senseActes: files.filter((r) => r.t === 0).length,
    comarques: new Set(files.map((r) => r.c).filter(Boolean)).size,
  };

  const comarques = [...new Set(files.map((r) => r.c).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ca"),
  );

  /**
   * La llista va sencera a l'HTML, fila a fila.
   *
   * Abans es dibuixava amb JavaScript des d'un JSON incrustat, i sense
   * JavaScript la pàgina era un títol i una llista buida: ni es podia llegir ni
   * s'arribava a cap fitxa. Ara el navegador només hi fa dues coses —cercar i
   * comptar—, i el que hi ha escrit no depèn que cap script s'executi.
   */
  const llista = files
    .map((f) => {
      const nom = escape(f.n);
      const titol =
        f.x === 1
          ? `<a class="municipi" href="m/${escape(f.s)}/">${nom}</a>`
          : `<span class="municipi">${nom}</span>`;
      const lloc = f.c
        ? `<a href="c/${escape(slugify(f.c))}/">${escape(f.c)}</a>`
        : "<span>sense comarca</span>";
      // Qui mana, amb la cara que publica el seu ajuntament i el color de la
      // seva força. Amb 947 files, un nom i unes sigles en text pla es
      // llegeixen d'una en una; la cara i el color es recullen d'una passada,
      // que és el que fa que aquesta llista es pugui recórrer de debò.
      const qui = f.a
        ? (() => {
            /*
             * El color el decideix la marca, i el mateix per a la cara i per a
             * la pastilla. Abans la cara el treia de `f.ac` i la pastilla se'l
             * pintava a part: quan `mapa-ara.ts` fa una fila a mà sense `ac`,
             * la pastilla sortia del color del partit i les inicials grises al
             * costat, com si fossin de dues persones diferents.
             */
            const marca = partitDe(f.g, f.b);
            const color = (marca ? BRANDS_BY_ID.get(marca)?.color : null) ?? f.ac ?? "#8b8b8b";
            const { fons, tinta } = sobreColor(color);
            const inicials = f.a
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0]!.toUpperCase())
              .join("");
            const cara = f.ar
              ? `<img class="cara" src="${escape(f.ar)}" alt="" loading="lazy" width="30" height="30">`
              : `<span class="cara inicials" style="--c:${fons};--t:${tinta}" aria-hidden="true">${escape(inicials)}</span>`;
            /*
             * Les sigles porten a la pàgina del partit quan sabem de quin és.
             * Les 947 pastilles d'aquesta llista eren l'exemple gros de la
             * pastilla morta: el nom de l'alcaldia porta a la seva fitxa i les
             * sigles del seu costat no portaven enlloc. Ho decideix `sigla()`
             * i no aquesta pàgina, que és el que fa que una llista local
             * —sense pàgina i sense haver-ne de tenir— es continuï quedant en
             * un `<b>` aquí i a tot arreu igual.
             */
            return `<p class="mana">${cara}<span class="qui-mana">${escape(nomLlegible(f.a))}</span>${
              f.g ? sigla(f.g, { base: "./", brandId: f.b, color: f.ac }) : ""
            }</p>`;
          })()
        : "";
      return `<li class="fila" data-k="${escape(clauCerca(f.n) + " " + clauCerca(f.c))}" data-f="${escape(
        marques(f, llindars).join(" "),
      )}" data-o="${clausOrdre(f)}">
<p class="titol">${titol}<span class="pob">${xifra(f.p)} hab.</span></p>
<p class="lloc">${lloc}</p>
${qui}
<p class="dades">${pastilles(f, llindars).join("")}</p>
</li>`;
    })
    .join("\n");

  const tries = GRUPS_FILTRE.map((grup) => {
    const seus = disponibles.filter((f) => f.grup === grup.clau);
    if (seus.length === 0) return "";
    const botons = seus
      .map(
        (f) => `<input class="commutador nomes-lectors" type="checkbox" id="f-${f.clau}" value="${f.clau}">
      <label class="filtre" for="f-${f.clau}">${escape(f.text(llindars))}<span class="quants" id="q-${f.clau}"></span></label>`,
      )
      .join("\n      ");
    return `<section class="colla">
    <h3>${icona(grup.tema)}${escape(grup.titol)}</h3>
    <div class="tries">
      ${botons}
    </div>
  </section>`;
  }).join("\n  ");

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Els 947 · Observatori de quivoto</title>
<meta name="description" content="Els 947 municipis de Catalunya en una llista, amb el que en sabem de cadascun: qui hi mana, si va guanyar, si ha canviat d'alcaldia, com estan els comptes i quantes actes del ple en tenim.">
<link rel="canonical" href="${SITE}/observatori/els947.html">
<style>${RADIOGRAFIA_CSS}${MASCOTA_CSS}${CSS}</style>
<script>document.documentElement.className += " js";</script>
</head>
<body>
<a class="salta" href="#llista">Ves a la llista</a>

${capcalera("./", "947")}
${cercador("./")}

<main>
<section class="portada">
  <div class="presenta">${papereta(120, "felic")}<div>
    <p class="micro">Tot Catalunya, sense triar</p>
    <h1>Els 947</h1>
  </div></div>
  <p class="entrada">Tots els municipis de Catalunya i el que en sabem: qui hi mana, si va ser la
  llista més votada, si hi ha hagut canvi d'alcaldia a mig mandat, com estan els comptes i quantes
  actes del ple en tenim indexades. <b>Sense cap excepció i sense cap municipi triat a dit.</b>
  Si el que busques és posar a prova si te'ls saps tots de memòria, això ho fa
  <a href="https://els947.cat/" target="_blank" rel="noopener">els947.cat</a>, un joc d'una altra
  gent amb qui no tenim cap relació.</p>
  <p class="pistes">
    <a class="prova-enllac" href="mapa/">Els mateixos 947, al mapa →</a>
    <a class="prova-enllac" href="comparador/">Posa'n quatre de costat →</a>
  </p>
</section>

<ul class="xifres">
  <li><b>${totals.municipis}</b><span>municipis, de ${totals.comarques} comarques</span></li>
  <li><b>${xifra(totals.regidories)}</b><span>regidories el 2023</span></li>
  <li><b>${totals.pacte}</b><span>on governa una llista que no va guanyar</span></li>
  <li><b>${totals.canvis}</b><span>han canviat d'alcaldia a mig mandat</span></li>
  <li><b>${totals.majoria}</b><span>amb majoria absoluta d'una sola llista</span></li>
  <li><b>${totals.sempre}</b><span>on la mateixa força ha guanyat sempre des del 1979</span></li>
  <li><b>${totals.senseOposicio}</b><span>amb una sola candidatura al ple</span></li>
  <li><b>${totals.senseActes}</b><span>sense cap acta de ple publicada</span></li>
</ul>

<form class="tauler" id="tauler">
  <div class="cercador">
    <label class="nomes-lectors" for="cerca">Cerca un municipi o una comarca</label>
    <input id="cerca" type="search" autocomplete="off" spellcheck="false"
      placeholder="Escriu un poble: esplugues, la seu, hospitalet…">
  </div>

  <div class="filtres" role="group" aria-label="Filtres">
  ${tries}
  </div>

  <section class="ordre colla" id="ordre">
    <!-- Sense icona a posta: les quatre colles de filtres en porten perquè
         cadascuna té un tema —el ple, els comptes, el municipi— i ordenar no
         és cap tema. Posar-n'hi una de manllevada només diria que hi falta. -->
    <h3>Per què s'ordena</h3>
    <div class="tries" role="group" aria-label="Ordena la llista">
      ${ordres.map(
        (o, i) => `<input class="commutador nomes-lectors" type="radio" name="ordre" id="o-${o.clau}" value="${
          o.clau
        }"${i === 0 ? " checked" : ""}>
      <label class="filtre" for="o-${o.clau}">${escape(o.text)}</label>`,
      ).join("\n      ")}
      <button class="capgira" type="button" id="capgira" aria-pressed="false">
        <span class="fletxa" aria-hidden="true">↓</span>Capgira l'ordre</button>
    </div>
  </section>

  <div class="eines">
    <button class="neteja" type="reset">Treu-ho tot</button>
    <p class="recompte" id="recompte" aria-live="polite">${totals.municipis} municipis, ${ordres[0]!.avall}</p>
  </div>

  <p class="nota">Les medianes són el municipi que queda al mig dels ${totals.municipis}: diuen on
  cau cadascun respecte dels altres, no si això està bé o malament. Els filtres es poden combinar, i
  la xifra de cada casella diu quants dels que ara es veuen hi entrarien. Cap ordre no és un
  rànquing de gestió, i qui no té la dada va sempre al final: un forat no és un zero.${
    llindars.renda === null
      ? ""
      : ` La renda per persona la tenen ${xifra(llindars.ambRenda)} dels ${totals.municipis}: l'INE
  tapa per secret estadístic la dels municipis més petits, i no tenir-la no vol dir no tenir-ne.`
  }</p>

  <ul class="llista" id="llista">
${llista}
  </ul>
  <p class="buit" id="buit" hidden>Cap municipi no coincideix. Prova amb menys lletres o treu algun filtre.</p>
</form>

<section class="bloc">
  <h2>Les ${comarques.length} comarques</h2>
  <p class="entrada-bloc">Cada comarca té la seva pàgina: quantes alcaldies hi té cada força i com
  hi queda cada municipi.</p>
  <nav class="index" aria-label="Comarques">${comarques
    .map((c) => `<a href="c/${escape(slugify(c))}/">${escape(c)}</a>`)
    .join("")}</nav>
</section>

<section class="bloc joc">
  <h2>I tu, te'ls saps?</h2>
  <p>Nosaltres tenim les dades dels 947. Saber-ne els noms i on són ja és una altra cosa.
  Hi ha un joc que ho posa a prova, i és boníssim:</p>
  <p class="crida"><a href="https://els947.cat/" target="_blank" rel="noopener">Ves a jugar a els947.cat →</a></p>
  <p class="nota">No hi tenim res a veure: és el repte de geografia catalana d'algú altre,
  i ens va recordar que 947 no és una xifra abstracta sinó 947 llocs amb gent que hi vota.</p>
</section>

<section class="bloc anar">
  <h2>Segueix estirant</h2>
  <ul class="destins">
    <li><a href="mapa/"><b>El mapa dels 947</b>
      <span>Els mateixos municipis, pintats: on hi ha majoria absoluta, on no governa qui va
      guanyar i on mana la mateixa força des del 1979</span></a></li>
    <li><a href="comparador/"><b>El comparador</b>
      <span>De dos a quatre municipis a la mateixa taula, amb la mateixa vara</span></a></li>
    <li><a href="preguntes/"><b>Les preguntes</b>
      <span>Les afirmacions que la brúixola farà, escrites llegint les actes del ple</span></a></li>
    <li><a href="dades/"><b>Baixa't les dades</b>
      <span>Tot això en CSV i JSON, amb l'esquema documentat i la font de cada xifra</span></a></li>
  </ul>
</section>

<section class="bloc fonts">
  <h2>D'on surt tot això</h2>
  <p class="nota">Padró, alcaldia i dades de l'ens, resultats des del 1979, llistes de candidats i
  historial d'alcaldies: dades obertes de la Generalitat de Catalunya. Comptes i deute: Ministeri
  d'Hisenda via el portal de la Generalitat. Índex d'actes del ple i compliment del portal de
  transparència: Consorci AOC. Renda neta mitjana per persona: Atles de distribució de renda de les
  llars (ADRH) de l'Institut Nacional d'Estadística; elaboració pròpia amb dades extretes del web de
  l'INE, <a href="https://www.ine.es/" target="_blank" rel="noopener">www.ine.es</a>, que en permet
  la reutilització citant-ne la font. Cada fitxa de municipi porta el codi del conjunt d'on surt cada
  xifra, i a <a href="dades/">dades obertes</a> hi ha l'esquema camp a camp.</p>
  <p class="nota">La renda no la decideix l'ajuntament: quant guanya la gent d'un poble depèn de qui
  hi viu i de què hi treballa. El que sí que decideix el ple és quines taxes cobra, a qui les
  bonifica i en què gasta.</p>
  <p class="nota">Aquí no hi ha cap veredicte de gestió: hi ha la dada, la font i on queda respecte
  de la resta. El judici és de qui llegeix.</p>
</section>
</main>
${peu("./", generatedAt)}


<script>
const norm = ${clauCerca.toString()};
const tauler = document.getElementById("tauler");
const llistaEl = document.getElementById("llista");
const files = Array.prototype.slice.call(tauler.querySelectorAll(".fila"));
const claus = files.map(function (el) { return el.getAttribute("data-k"); });
const marques = files.map(function (el) { return " " + el.getAttribute("data-f") + " "; });
const caselles = Array.prototype.slice.call(tauler.querySelectorAll(".commutador[type=checkbox]"));
const cerca = document.getElementById("cerca");
const recompte = document.getElementById("recompte");
const buit = document.getElementById("buit");
const capgira = document.getElementById("capgira");
const TOTAL = files.length;

// Els comptadors de cada filtre. Es guarden un cop i no es tornen a buscar:
// «pinta» s'executa a cada lletra que s'escriu al cercador.
const quants = {};
for (const clau of ${JSON.stringify(disponibles.map((f) => f.clau))}) {
  quants[clau] = document.getElementById("q-" + clau);
}

/*
 * Les xifres per ordenar, tal com viatgen a «data-o».
 *
 * Es llegeixen una sola vegada i es guarden com a nombres: llegir l'atribut i
 * convertir-lo dins del comparador seria fer-ho unes 9.000 vegades per cada
 * canvi d'ordre. El buit es queda com a «null» i no com a zero.
 */
const ORDRES = ${JSON.stringify(
    ordres.map((o) => ({ c: o.clau, d: o.de, i: o.i ?? 0, g: o.gran, a: o.avall, m: o.amunt })),
  )};
const xifres = files.map(function (el) {
  return el.getAttribute("data-o").split("|").map(function (v) {
    return v === "" ? null : Number(v);
  });
});
// L'ordre inicial és el que ja té l'HTML: de més població a menys. Guardar-lo
// serveix per desempatar sempre igual, que és el que fa que dos municipis amb
// la mateixa renda no ballin cada vegada que es torna a ordenar.
const inicial = files.map(function (_, i) { return i; });

function ordreTriat() {
  const marcat = tauler.querySelector("input[name=ordre]:checked");
  const clau = marcat ? marcat.value : ORDRES[0].c;
  for (const o of ORDRES) { if (o.c === clau) return o; }
  return ORDRES[0];
}

/*
 * Ordenar les 947 files.
 *
 * Es mouen els nodes que ja hi ha —no se'n dibuixa cap de nou— dins d'un
 * fragment, i el navegador només refà la pàgina un cop. Qui no té la dada va
 * sempre al final, tant si es demana de més a menys com al revés: un forat no
 * és un zero i no ha de competir amb ningú.
 */
// Com es diu l'ordre que mana ara. El recompte l'ha de dir cada cop que canvia
// el que es veu, també quan només s'ha escrit una lletra al cercador.
let diu = ORDRES[0].a;

function ordena() {
  const o = ordreTriat();
  const invertit = capgira.getAttribute("aria-pressed") === "true";
  const gran = o.g !== invertit;
  const ordenats = inicial.slice();
  ordenats.sort(function (a, b) {
    // La població no viatja a «data-o»: la llista ja ve escrita de més gran a
    // més petita, i tornar-hi és tornar a l'ordre de sortida.
    if (o.d === "escrit") return gran ? a - b : b - a;
    if (o.d === "nom") {
      const na = claus[a], nb = claus[b];
      if (na !== nb) return (na < nb ? -1 : 1) * (gran ? -1 : 1);
      return a - b;
    }
    const va = xifres[a][o.i], vb = xifres[b][o.i];
    if (va === null && vb === null) return a - b;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va !== vb) return gran ? vb - va : va - vb;
    return a - b;
  });
  const fragment = document.createDocumentFragment();
  for (const i of ordenats) fragment.appendChild(files[i]);
  llistaEl.appendChild(fragment);
  capgira.querySelector(".fletxa").textContent = gran ? "↓" : "↑";
  diu = invertit ? o.m : o.a;
}

// El navegador ja amaga les files amb els filtres de CSS; això ho torna a fer
// perquè el recompte sigui cert i perquè funcioni igual si algun no sap «:has()».
function pinta() {
  const q = norm(cerca.value);
  const actius = caselles.filter(function (c) { return c.checked; })
    .map(function (c) { return " " + c.value + " "; });
  const facetes = {};
  let queden = 0;
  for (let i = 0; i < TOTAL; i++) {
    let hi = q === "" || claus[i].indexOf(q) !== -1;
    for (let j = 0; hi && j < actius.length; j++) {
      if (marques[i].indexOf(actius[j]) === -1) hi = false;
    }
    if (hi) {
      queden++;
      // Quants dels que ara es veuen porten cada marca: és el que quedarà si
      // es marca aquell filtre, i per això canvia amb la cerca i amb la resta.
      for (const clau of marques[i].trim().split(" ")) {
        if (clau !== "") facetes[clau] = (facetes[clau] || 0) + 1;
      }
    }
    files[i].classList.toggle("fora", !hi);
  }
  for (const clau in quants) {
    quants[clau].textContent = "(" + (facetes[clau] || 0) + ")";
  }
  buit.hidden = queden > 0;
  recompte.textContent = queden === TOTAL
    ? TOTAL + " municipis, " + diu
    : queden + " de " + TOTAL + " municipis, " + diu;
}

function refresca() { ordena(); pinta(); }

cerca.addEventListener("input", pinta);
tauler.addEventListener("change", refresca);
capgira.addEventListener("click", function () {
  capgira.setAttribute("aria-pressed", capgira.getAttribute("aria-pressed") === "true" ? "false" : "true");
  refresca();
});
tauler.addEventListener("reset", function () {
  capgira.setAttribute("aria-pressed", "false");
  setTimeout(refresca, 0);
});
refresca();
</script>
</body>
</html>`;
}
