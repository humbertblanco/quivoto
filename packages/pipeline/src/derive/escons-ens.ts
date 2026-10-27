import type { RepartimentEns } from "../publish/ens-tipus";

/**
 * Els escons que la llei dona a cada partit a les diputacions i als consells
 * comarcals, refets a partir dels resultats de les municipals del 2023.
 *
 * Ni les diputacions ni els consells no es voten: s'omplen amb regidors, i
 * qui en treu quants ho decideix una fórmula que aplica la junta electoral
 * quan ja s'han constituït els ajuntaments. Aquest mòdul fa la mateixa
 * operació amb les dades obertes, perquè la fitxa pugui explicar d'on surt el
 * ple que té davant (i dir-ho quan no en surt).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES DIPUTACIONS — LOREG art. 204 i 205 (text consolidat del BOE)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · **Quants escons** (204.1), pels residents de la província: fins a
 *     500.000, 25; fins a 1.000.000, 27; fins a 3.500.000, 31; més, 51.
 *   · **Quants a cada districte** (204.2). Els districtes són els partits
 *     judicials de les eleccions locals del 1979 (204.3). Es reparteixen en
 *     proporció als residents: tots en tenen almenys un, cap no en pot tenir
 *     més de tres cinquens del total, les fraccions de 0,50 o més s'arrodoneixen
 *     amunt i les altres avall. Si la suma no quadra, la lletra d) diu
 *     exactament com corregir-ho, i és més precisa que el brief: **si en
 *     sobren** es treuen als districtes amb **menys** residents per diputat;
 *     **si en falten** s'afegeixen als que en tenen **més**. Aquí es fa un
 *     escó cada vegada i es torna a calcular la ràtio després de cada canvi.
 *   · **Qui hi entra** (205.1): els partits, coalicions, federacions i cada
 *     agrupació d'electors que han tret **algun regidor dins el districte**.
 *     No hi ha la barrera del 3 % de l'art. 163.1.a: el filtre és el regidor.
 *   · **Amb quins vots** (205.3): la llei d'Hondt sobre els **vots** (no sobre
 *     els regidors) de tot el districte, també els dels municipis on aquell
 *     partit no va treure ningú.
 *   · **Empats** (205.4): a quocients iguals, guanya qui té més vots al
 *     districte; després, qui té més regidors al districte; i si encara
 *     empaten, sorteig.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ELS CONSELLS COMARCALS — Decret legislatiu 4/2003, art. 20
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · **Quants consellers** (20.1): fins a 50.000 residents, 19; fins a
 *     100.000, 25; fins a 500.000, 33; més, 39.
 *   · **Qui hi entra** (20.2): qui té el 3 % o més dels vots de la comarca.
 *   · **La puntuació** (20.6): el percentatge de regidors sobre **tots** els
 *     regidors de la comarca per 1/3, més el percentatge de vots sobre **tots**
 *     els vots de la comarca per 2/3. Els totals inclouen les llistes que no
 *     arriben al 3 %. Després, la llei d'Hondt sobre aquesta puntuació.
 *   · **Empats** (20.6.f): a quocients iguals, la puntuació més alta; si
 *     també empata, la llista amb més vots a la comarca (la llei diu que els
 *     empats següents s'alternen; aquí no se n'ha trobat mai cap).
 *   · **Sobre quins vots es fan els percentatges.** La llei diu «el tres por
 *     ciento o más de votos en la comarca» (20.2) i «sobre el total de votos
 *     emitidos en la comarca» (20.6.b), i no aclareix si hi entren blancs i
 *     nuls. Ho han decidit els plens de veritat: la barrera del 3 % es mira
 *     sobre els **vots emesos** (candidatures + blancs + nuls) —és l'única
 *     manera que Vox quedi fora del Vallès Oriental, com hi és— i el
 *     percentatge de la puntuació, sobre els **vots vàlids** (candidatures +
 *     blancs) —amb els nuls dins, Junts perdria un conseller a l'Alt Camp, on
 *     en té vuit amb nom; sense els blancs, ERC en perdria un al Baix Ebre—.
 *     Cap altra combinació reprodueix tots tres. Per això `VotsMunicipi` porta
 *     dos camps opcionals, `blancs` i `nuls`: si el carregador no els dona, la
 *     base és la suma dels vots a candidatures i aquests tres consells no
 *     quadren.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ELS MUNICIPIS DE LLISTA OBERTA (fins a 250 habitants)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * LOREG 205.2 i DL 4/2003 20.3 diuen el mateix: als municipis de l'art. 184
 * els vots d'una candidatura són **la suma dels vots de les seves persones
 * candidates dividida pel nombre de candidats de la llista, fins a un màxim
 * de quatre**, i les fraccions s'arrodoneixen avall.
 *
 * Compte, però, amb què porta la font. **El `vots` de `ntc4-rnwr` en aquests
 * municipis ja és un vot de candidatura dividit**: és la xifra «votos de
 * candidatura» del Ministeri de l'Interior (fitxer 12 del zip de municipals).
 * Comprovat el 27-10-2026 amb les 504 candidatures catalanes de llista
 * oberta del 2019 (el zip del 2023 no es pot baixar: el Ministeri no respon i
 * el mirall de `JaimeObregon/infoelectoral` s'atura al 2019): les 504
 * coincideixen amb la columna del Ministeri, i aquesta és sempre la suma
 * dels vots personals dividida pel **mínim entre els candidats i els noms
 * que pot escriure cada elector** (4 als municipis de cinc regidories, 2 als
 * de tres, 1 en consell obert). En 35 llistes de municipis de fins a 100
 * habitants amb tres candidats, això dona un resultat diferent del de la
 * lletra de la llei (que dividiria per 3 i no per 2).
 *
 * Per això:
 *
 *   · Si `candidats` és un número, `vots` s'entén com la **suma dels vots
 *     personals** (el fitxer 12 o la J37) i es divideix aquí, amb la regla
 *     de la llei: `floor(vots / min(candidats, 4))`.
 *   · Si `candidats` és `null`, `vots` es pren **tal com ve**: s'entén que ja
 *     és el vot de candidatura que publica la font. **És el que ha de fer el
 *     carregador amb els vots de `ntc4-rnwr`**: passar-hi `candidats: null`.
 *     Dividir-los un altre cop els faria quatre vegades més petits.
 *
 * Quins municipis són de llista oberta es decideix pel ple que en va sortir
 * (la suma de `regidors`, de 1 a 5, que només es dona als de fins a 250
 * habitants: LOREG 179 i 184), i només si no hi ha regidors per `poblacio`
 * ≤ 250. El ple és més segur que el padró: el que compta és el padró amb què
 * es va convocar l'elecció (1-1-2022, RD 1037/2022), i el carregador pot
 * tenir-ne un de més nou.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ UNA LLEI D'HONDT PRÒPIA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `dHondt()` de `shared-schemas/seats.ts` és la de l'art. 163 per als plens
 * municipals: una barrera percentual, un sol desempat (més vots) i quocients
 * en coma flotant. Aquí en calen dos de desempat que no són el mateix (vots i
 * després regidors a les diputacions; puntuació i després vots als consells),
 * cap barrera percentual a les diputacions, i una puntuació de consell que
 * en coma flotant faria empats falsos. Per això els quocients es comparen
 * amb enters: el pes de cada llista és enter i `a/(i+1)` contra `b/(j+1)` es
 * resol multiplicant en creu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA VALIDACIÓ AMB ELS PLENS DE VERITAT (27-10-2026)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Amb un guió d'un sol ús (fora del repositori) que llegeix de Socrata els
 * resultats del 2023 (`ntc4-rnwr`, M20231, nivell MU), els blancs i nuls
 * (`irrv-2mfc`), el padró de l'1-1-2022 (`x5sz-niat`, any 2022), els
 * districtes (`ehvx-5ty7.partit_electoral`) i la composició (`nm3n-3vbj`).
 * Partits agrupats per `agrupacio_sigles` (AM = ERC, CM = Junts, PSC-CP,
 * AMUNT = CUP, C = Comuns, ARA PL…) i, si és «ALTRES», per sigles.
 *
 *   · **Les quatre diputacions quadren.** Tarragona i Lleida contra
 *     `nm3n-3vbj`; Barcelona (PSC 17, Junts 12, ERC 11, Comuns 5, PP 4, Vox 1,
 *     Tot per Terrassa 1) i Girona (Junts 10, ERC 8, PSC 5, CUP 2, Tots per
 *     l'Empordà 1, Independents de la Selva 1) contra la premsa i la
 *     Viquipèdia, perquè `nm3n-3vbj` no hi porta partits. Dues condicions:
 *       – **El padró de la convocatòria.** Amb el del 2025, Barcelona dona
 *         PSC 18 i ERC 10, que no és el ple.
 *       – **Lleida té nou districtes, no sis.** El 1979 hi havia també les
 *         Borges Blanques, Solsona i Sort, i la junta del 2023 va repartir
 *         Lleida 13, Balaguer 3, Cervera 3 i un a cadascun dels altres sis.
 *         `ehvx-5ty7.partit_electoral` en dona sis (Lleida 14, Seu 2…) i
 *         amb ells el càlcul falla. Quadra amb les Borges = la comarca de les
 *         Garrigues, Sort = el Pallars Sobirà i Solsona = el partit judicial
 *         actual de Solsona (`ehvx-5ty7.partit_judicial`). A Tarragona els
 *         cinc de `partit_electoral` sí que són els bons.
 *   · **Consells: 30 de 40 quadren exactament**, entre ells el Pla de
 *     l'Estany, la Garrotxa, el Bages, l'Alt Empordà, el Gironès, el Vallès
 *     Occidental i Osona (comptant-hi els municipis del Lluçanès, que el 2023
 *     encara eren del consell d'Osona). Tres més quadren si es llegeix bé la
 *     font: a l'Alt Camp hi ha un seient vacant (fila «-»), a la Cerdanya un
 *     conseller d'ERC consta com a «No adscrita» i al Segrià un del PP consta
 *     com a «N/A». En quatre la diferència és d'un sol conseller entre dues
 *     llistes, sense cap empat a prop (la Segarra, les Garrigues, el Baix
 *     Camp, el Berguedà) i en un, el Moianès, de dos amb dos membres sense
 *     partit: canvis de grup o llistes locals que la junta va comptar amb un
 *     altre partit del que diu `agrupacio_sigles`. Al Baix Llobregat (PSC 19
 *     al ple, 17 al càlcul) i al Garraf (PSC 16, 13 al càlcul) la distància
 *     no té cap lectura legal possible, i el registre no és fiable: al Garraf
 *     hi ha una persona repetida.
 *
 * Moralitat per a la pàgina: quan `quadra` és fals, el ple és el que mana i
 * el càlcul s'ha de presentar com el que diu la llei amb els vots, no com
 * una errada del ple.
 */

/** Una candidatura en un municipi, amb la clau de partit ja normalitzada. */
export type CandidaturaMunicipi = { partit: string; vots: number; regidors: number; candidats: number | null };

/**
 * Els resultats d'un municipi. `poblacio`: residents del padró amb què es va
 * convocar l'elecció (1-1-2022 per al 2023). `blancs` i `nuls`: els vots en
 * blanc i nuls del municipi (`irrv-2mfc`: `vots_blancs`, `vots_nuls`), que
 * entren a les bases dels percentatges dels consells (vegeu el comentari del
 * mòdul). Són opcionals perquè el tipus es va pactar sense; sense ells la
 * base és només la dels vots a candidatures. Les diputacions no els fan servir.
 */
export type VotsMunicipi = {
  municipalityId: number;
  poblacio: number;
  candidatures: CandidaturaMunicipi[];
  blancs?: number | null;
  nuls?: number | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Quants escons
// ─────────────────────────────────────────────────────────────────────────────

/** Escons d'una diputació pels residents de la província (LOREG 204.1). */
export function seientsDiputacio(poblacioProvincia: number): number {
  if (poblacioProvincia <= 500_000) return 25;
  if (poblacioProvincia <= 1_000_000) return 27;
  if (poblacioProvincia <= 3_500_000) return 31;
  return 51;
}

/** Consellers d'un consell comarcal pels residents de la comarca (DL 4/2003, 20.1). */
export function seientsConsell(poblacioComarca: number): number {
  if (poblacioComarca <= 50_000) return 19;
  if (poblacioComarca <= 100_000) return 25;
  if (poblacioComarca <= 500_000) return 33;
  return 39;
}

/**
 * Els escons de cada districte (LOREG 204.2): proporció amb arrodoniment a
 * 0,50, mínim d'un, sostre de tres cinquens del total, i correcció d'un escó
 * cada vegada fins que la suma és el total: si en sobren, al districte amb
 * menys residents per diputat; si en falten, al que en té més. A ràtios
 * iguals decideix la població (més gran primer per afegir, més petita per
 * treure) i, si cal, el nom, perquè el resultat sigui sempre el mateix.
 */
export function seientsPerDistricte(
  districtes: readonly { nom: string; poblacio: number }[],
  total: number,
): Map<string, number> {
  const resultat = new Map<string, number>();
  if (districtes.length === 0) return resultat;
  // Amb un sol districte el sostre no es pot complir i no s'aplica: tots els
  // escons hi van. Amb dos o més, cap no en pot tenir més de 3/5 (lletra b).
  const sostre = districtes.length > 1 ? Math.floor((total * 3) / 5) : total;
  const poblacioTotal = districtes.reduce((a, d) => a + d.poblacio, 0);

  for (const d of districtes) {
    const quota = poblacioTotal > 0 ? (d.poblacio * total) / poblacioTotal : 0;
    // Les fraccions de 0,50 o més, amunt (lletra c). `Math.floor(x + 0.5)`
    // ho fa sense les sorpreses de `Math.round` amb els negatius.
    const arrodonit = Math.floor(quota + 0.5);
    resultat.set(d.nom, Math.min(sostre, Math.max(1, arrodonit)));
  }

  const ratio = (d: { nom: string; poblacio: number }): number => d.poblacio / resultat.get(d.nom)!;
  let suma = [...resultat.values()].reduce((a, b) => a + b, 0);
  // Cada volta mou un escó; el límit només evita un bucle si el total és impossible.
  for (let volta = 0; suma !== total && volta < total * districtes.length + 10; volta += 1) {
    if (suma > total) {
      const candidats = districtes.filter((d) => resultat.get(d.nom)! > 1);
      if (candidats.length === 0) break;
      candidats.sort((a, b) => ratio(a) - ratio(b) || a.poblacio - b.poblacio || a.nom.localeCompare(b.nom));
      const triat = candidats[0]!;
      resultat.set(triat.nom, resultat.get(triat.nom)! - 1);
      suma -= 1;
    } else {
      const candidats = districtes.filter((d) => resultat.get(d.nom)! < sostre);
      if (candidats.length === 0) break;
      candidats.sort((a, b) => ratio(b) - ratio(a) || b.poblacio - a.poblacio || a.nom.localeCompare(b.nom));
      const triat = candidats[0]!;
      resultat.set(triat.nom, resultat.get(triat.nom)! + 1);
      suma += 1;
    }
  }
  return resultat;
}

// ─────────────────────────────────────────────────────────────────────────────
// La llei d'Hondt amb els desempats de cada llei
// ─────────────────────────────────────────────────────────────────────────────

/** Una llista que opta a escons: `pes` és el que es divideix per 1, 2, 3… */
type Aspirant = {
  clau: string;
  /** Enter: els vots (diputacions) o el numerador comú de la puntuació (consells). */
  pes: number;
  /** Els desempats de la llei, per ordre; guanya el més alt. */
  desempats: readonly number[];
};

type ResultatHondt = {
  seients: Map<string, number>;
  /** Les llistes que s'han endut un escó que la llei hauria sortejat. */
  sortejos: string[];
};

/**
 * D'Hondt amb comparació exacta: `a/(i+1)` contra `b/(j+1)` es resol com
 * `a·(j+1)` contra `b·(i+1)`, tot enters. Si el quocient empata es miren els
 * desempats per ordre; si també empaten, la llei sorteja i aquí guanya la
 * clau alfabèticament primera, però es deixa anotat.
 *
 * Només s'anota quan el sorteig **canvia el resultat**: quan hi ha més llistes
 * empatades que escons per repartir. Dues llistes amb els mateixos vots i
 * quatre escons s'emporten dos i dos tregui qui tregui primer, i dir que hi ha
 * hagut un sorteig seria fals.
 */
function dHondtLegal(aspirants: readonly Aspirant[], escons: number): ResultatHondt {
  const seients = new Map<string, number>(aspirants.map((a) => [a.clau, 0]));
  const sortejos: string[] = [];
  const valids = aspirants.filter((a) => a.pes > 0);

  for (let s = 0; s < escons; s += 1) {
    let millor: Aspirant | null = null;
    let empatPerSorteig = false;
    for (const a of valids) {
      if (millor === null) {
        millor = a;
        continue;
      }
      const ordre = compara(a, millor, seients);
      if (ordre > 0) {
        millor = a;
        empatPerSorteig = false;
      } else if (ordre === 0) {
        // Empat total: es queda el que ja hi era si va primer per clau.
        if (a.clau.localeCompare(millor.clau) < 0) millor = a;
        empatPerSorteig = true;
      }
    }
    if (millor === null) break;
    if (empatPerSorteig) {
      const guanyador = millor;
      const empatats = valids.filter((a) => a === guanyador || compara(a, guanyador, seients) === 0).length;
      if (empatats > escons - s) sortejos.push(millor.clau);
    }
    seients.set(millor.clau, seients.get(millor.clau)! + 1);
  }
  return { seients, sortejos };
}

/** Positiu si `a` passa davant de `b` per al proper escó, 0 si empaten del tot. */
function compara(a: Aspirant, b: Aspirant, seients: ReadonlyMap<string, number>): number {
  const qa = a.pes * (seients.get(b.clau)! + 1);
  const qb = b.pes * (seients.get(a.clau)! + 1);
  if (qa !== qb) return qa - qb;
  for (let i = 0; i < Math.max(a.desempats.length, b.desempats.length); i += 1) {
    const d = (a.desempats[i] ?? 0) - (b.desempats[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Els vots que compten
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cert si el municipi va votar amb llista oberta: pel ple que en va sortir
 * (de 1 a 5 regidors), o pel padró si no hi ha cap regidor a les dades.
 */
function esLlistaOberta(m: VotsMunicipi): boolean {
  const regidors = m.candidatures.reduce((a, c) => a + c.regidors, 0);
  return regidors > 0 ? regidors <= 5 : m.poblacio <= 250;
}

/**
 * Els vots d'una candidatura tal com els compta la junta (LOREG 205.2, DL
 * 4/2003 20.3). Només es divideix quan el carregador dona `candidats`, és a
 * dir, quan `vots` és la suma de vots personals; amb `null` es pren tal com
 * ve, perquè `ntc4-rnwr` ja porta el vot de candidatura dividit.
 */
function votsComputables(c: CandidaturaMunicipi, llistaOberta: boolean): number {
  if (!llistaOberta || c.candidats === null || c.candidats <= 0) return c.vots;
  return Math.floor(c.vots / Math.min(c.candidats, 4));
}

type Suma = { vots: number; regidors: number };

/** Vots i regidors per partit d'un conjunt de municipis. */
function sumaPerPartit(municipis: readonly VotsMunicipi[]): Map<string, Suma> {
  const sumes = new Map<string, Suma>();
  for (const m of municipis) {
    const oberta = esLlistaOberta(m);
    for (const c of m.candidatures) {
      const s = sumes.get(c.partit) ?? { vots: 0, regidors: 0 };
      s.vots += votsComputables(c, oberta);
      s.regidors += c.regidors;
      sumes.set(c.partit, s);
    }
  }
  return sumes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Els repartiments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El repartiment d'una diputació: escons per districte, D'Hondt sobre els
 * vots de cada districte entre els partits amb algun regidor al districte, i
 * la suma per partit de tota la província. `reals` són els escons que hi ha
 * de fet, amb les mateixes claus de partit, o `null` si no se saben.
 */
export function repartimentDiputacio(
  districtes: readonly { nom: string; municipis: readonly VotsMunicipi[] }[],
  total: number,
  reals: ReadonlyMap<string, number> | null,
): RepartimentEns {
  const ambPoblacio = districtes.map((d) => ({
    nom: d.nom,
    municipis: d.municipis,
    poblacio: d.municipis.reduce((a, m) => a + m.poblacio, 0),
  }));
  const escons = seientsPerDistricte(ambPoblacio, total);

  const provincia = new Map<string, Suma>();
  const calculats = new Map<string, number>();
  const entren = new Set<string>();
  const sortejos: string[] = [];
  const perDistricte: NonNullable<RepartimentEns["districtes"]> = [];

  for (const d of ambPoblacio) {
    const sumes = sumaPerPartit(d.municipis);
    for (const [partit, s] of sumes) {
      const p = provincia.get(partit) ?? { vots: 0, regidors: 0 };
      p.vots += s.vots;
      p.regidors += s.regidors;
      provincia.set(partit, p);
    }
    const aspirants: Aspirant[] = [...sumes]
      .filter(([, s]) => s.regidors >= 1)
      .map(([clau, s]) => ({ clau, pes: s.vots, desempats: [s.vots, s.regidors] }));
    for (const a of aspirants) entren.add(a.clau);

    const seients = escons.get(d.nom) ?? 0;
    const hondt = dHondtLegal(aspirants, seients);
    sortejos.push(...hondt.sortejos);
    const repartits = [...hondt.seients]
      .filter(([, n]) => n > 0)
      .map(([partit, n]) => ({ partit, seients: n }))
      .sort((a, b) => b.seients - a.seients || (sumes.get(b.partit)!.vots - sumes.get(a.partit)!.vots));
    for (const r of repartits) calculats.set(r.partit, (calculats.get(r.partit) ?? 0) + r.seients);
    perDistricte.push({ nom: d.nom, poblacio: d.poblacio, seients, perPartit: repartits });
  }

  const files = muntaFiles(entren, provincia, calculats, null, reals);
  return { files, districtes: perDistricte, ...comparaAmbReals(files, reals, sortejos) };
}

/**
 * El repartiment d'un consell comarcal: llistes amb el 3 % dels vots emesos a
 * la comarca, puntuació d'1/3 del percentatge de regidors i 2/3 del de vots, i
 * D'Hondt sobre la puntuació. Els escons surten de la població sumada dels
 * municipis (DL 4/2003, 20.1).
 */
export function repartimentConsell(
  municipis: readonly VotsMunicipi[],
  reals: ReadonlyMap<string, number> | null,
): RepartimentEns {
  const total = seientsConsell(municipis.reduce((a, m) => a + m.poblacio, 0));
  const sumes = sumaPerPartit(municipis);
  // V: vots vàlids (candidatures + blancs), base del percentatge de vots.
  // E: vots emesos (vàlids + nuls), base de la barrera del 3 %.
  const V = [...sumes.values()].reduce((a, s) => a + s.vots, 0)
    + municipis.reduce((a, m) => a + (m.blancs ?? 0), 0);
  const E = V + municipis.reduce((a, m) => a + (m.nuls ?? 0), 0);
  const R = [...sumes.values()].reduce((a, s) => a + s.regidors, 0);

  // Puntuació = (r/R)/3 + 2(v/V)/3 = (r·V + 2·v·R) / (3·R·V). El denominador
  // és comú a totes les llistes i D'Hondt no el necessita: el pes és el numerador.
  const entren = new Set<string>();
  const puntuacions = new Map<string, number>();
  const aspirants: Aspirant[] = [];
  if (V > 0 && R > 0) {
    for (const [clau, s] of sumes) {
      if (s.vots * 100 < E * 3) continue;
      const pes = s.regidors * V + 2 * s.vots * R;
      entren.add(clau);
      puntuacions.set(clau, ((s.regidors / R) * 100) / 3 + ((s.vots / V) * 100 * 2) / 3);
      aspirants.push({ clau, pes, desempats: [pes, s.vots] });
    }
  }
  const hondt = dHondtLegal(aspirants, total);
  const calculats = new Map([...hondt.seients].filter(([, n]) => n > 0));
  const files = muntaFiles(entren, sumes, calculats, puntuacions, reals);
  return { files, districtes: null, ...comparaAmbReals(files, reals, hondt.sortejos) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Les files i la comparació amb el ple
// ─────────────────────────────────────────────────────────────────────────────

type Fila = RepartimentEns["files"][number];

/**
 * Una fila per cada llista que entra al repartiment i, a més, per cada partit
 * que té escons de veritat sense haver-hi entrat (perquè la pàgina pugui dir
 * d'on surten). De més a menys escons calculats, i després de més a menys vots.
 */
function muntaFiles(
  entren: ReadonlySet<string>,
  sumes: ReadonlyMap<string, Suma>,
  calculats: ReadonlyMap<string, number>,
  puntuacions: ReadonlyMap<string, number> | null,
  reals: ReadonlyMap<string, number> | null,
): Fila[] {
  const claus = new Set(entren);
  for (const [partit, n] of reals ?? []) if (n > 0) claus.add(partit);
  const files: Fila[] = [...claus].map((partit) => ({
    partit,
    vots: sumes.get(partit)?.vots ?? 0,
    regidors: sumes.get(partit)?.regidors ?? 0,
    puntuacio: puntuacions?.get(partit) ?? null,
    seientsCalculats: calculats.get(partit) ?? 0,
    seientsReals: reals === null ? null : reals.get(partit) ?? 0,
  }));
  return files.sort(
    (a, b) => b.seientsCalculats - a.seientsCalculats || b.vots - a.vots || a.partit.localeCompare(b.partit),
  );
}

/**
 * Quadra si cada partit té els mateixos escons al càlcul i al ple. Sense
 * `reals` no es pot dir que quadri: `false` i cap diferència, i la pàgina ho
 * sap perquè `seientsReals` és `null`. Els escons que la llei hauria sortejat
 * es diuen com una diferència més, perquè el càlcul n'ha triat un a l'atzar.
 */
function comparaAmbReals(
  files: readonly Fila[],
  reals: ReadonlyMap<string, number> | null,
  sortejos: readonly string[],
): Pick<RepartimentEns, "quadra" | "diferencies"> {
  const diferencies: string[] = [];
  for (const partit of new Set(sortejos)) {
    diferencies.push(`Un escó ${dePartit(partit)} surt d'un empat que la llei resol per sorteig.`);
  }
  if (reals === null) return { quadra: false, diferencies };
  let quadra = true;
  for (const f of files) {
    const real = f.seientsReals ?? 0;
    if (f.seientsCalculats === real) continue;
    quadra = false;
    diferencies.push(fraseDiferencia(f.partit, f.seientsCalculats, real));
  }
  return { quadra, diferencies };
}

/** «El càlcul dona 9 escons al PSC i el ple en té 8.» */
function fraseDiferencia(partit: string, calculats: number, reals: number): string {
  const calcul = calculats === 0
    ? `El càlcul no dona cap escó ${aPartit(partit)}`
    : `El càlcul dona ${calculats} ${calculats === 1 ? "escó" : "escons"} ${aPartit(partit)}`;
  const ple = reals === 0 ? "el ple no en té cap" : `el ple en té ${reals}`;
  return `${calcul} i ${ple}.`;
}

/**
 * Les sigles que en català porten article. La resta (ERC, Junts, Vox, les
 * llistes locals) s'escriuen sense: «a ERC», «de Junts», «d'Units per…».
 */
const ARTICLES: readonly [prefix: RegExp, article: "el" | "la" | "els"][] = [
  [/^(PSC|PP|PDeCAT|PNC|PSOE)\b/i, "el"],
  [/^CUP\b/i, "la"],
  [/^Comuns\b/i, "els"],
];

function articleDe(partit: string): "el" | "la" | "els" | null {
  for (const [prefix, article] of ARTICLES) if (prefix.test(partit)) return article;
  return null;
}

/** «al PSC», «a la CUP», «als Comuns», «a ERC». */
function aPartit(partit: string): string {
  const article = articleDe(partit);
  if (article === "el") return `al ${partit}`;
  if (article === "els") return `als ${partit}`;
  if (article === "la") return `a la ${partit}`;
  return `a ${partit}`;
}

/** «del PSC», «de la CUP», «dels Comuns», «d'ERC», «de Junts». */
function dePartit(partit: string): string {
  const article = articleDe(partit);
  if (article === "el") return `del ${partit}`;
  if (article === "els") return `dels ${partit}`;
  if (article === "la") return `de la ${partit}`;
  return /^[aeiouàèéíòóúAEIOUÀÈÉÍÒÓÚhH]/.test(partit) ? `d'${partit}` : `de ${partit}`;
}
