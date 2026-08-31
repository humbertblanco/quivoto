/**
 * Els gràfics de l'Observatori, en SVG i sense cap llibreria.
 *
 * Fins ara tot el que semblava un gràfic eren caixes de CSS amb una amplada o
 * una alçada en tant per cent. Això va bé per a una barra i una proporció, i no
 * va bé per a una sèrie: les columnes del deute posaven el 2015 i el 2025 a la
 * mateixa distància que el 2015 i el 2016, i un any que falta hi desapareixia
 * sense deixar cap forat. Amb un eix de veritat, un any que falta es veu.
 *
 * Tres regles que valen per a tot el que hi hagi aquí:
 *
 *   1. **Res que no es pugui llegir sense veure-hi.** Cada gràfic porta el seu
 *      equivalent en text: no un `title` —que al mòbil no existeix i que molts
 *      lectors de pantalla no diuen mai— sinó una taula de debò, amagada als
 *      ulls i present a l'arbre. Si el gràfic no es pot escriure en una taula,
 *      és que no sabem què estem dibuixant. La classe d'amagar va **al div que
 *      l'embolcalla, mai a la taula**: una taula no es creu `width:1px`.
 *   2. **L'escala no és una opinió.** Un eix que no comença a zero fa semblar
 *      un terratrèmol el que és un sotrac, i és la manera més fàcil de mentir
 *      amb una dada certa. Aquí es comença a zero sempre que el zero vulgui dir
 *      alguna cosa, i quan no s'hi comença es diu.
 *   3. **Cap color de dada no s'anima ni fa degradat.** És la regla de
 *      `design/MOVIMENT.md` i aquí també val: el color d'un partit o d'una
 *      banda de comparació és informació, no decoració.
 *
 * El CSS d'aquest mòdul viu aquí i s'enganxa al full de la fitxa des de
 * `estil.ts`, per no fer créixer aquell fitxer amb regles que només fa servir
 * un component.
 */

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Un punt de la sèrie del municipi. Un any sense dada no hi és, i es nota. */
export type PuntSerie = { any: number; valor: number };

/** El tram on cau la meitat central del grup de comparació, any per any. */
export type BandaGrup = { any: number; p25: number; p50: number; p75: number };

/** Un tros de l'eix que pertany a un mandat, per dir de qui és cada pendent. */
export type TramMandat = { desDe: number; finsA: number; etiqueta: string };

/**
 * Quant de lloc ocupa una sèrie.
 *
 * La mateixa funció dibuixa la gràfica gran del deute i la ratlleta que va al
 * costat d'una xifra. Fins ara només hi havia la gran, i per això a tot arreu
 * on hi havia una sèrie hi acabava havent una taula o una espurna feta a part,
 * cadascuna amb la seva idea de què és una línia. Una sola funció amb tres
 * mides vol dir que la línia del deute i la de la població es llegeixen igual.
 *
 *   - `gran`: 720×300. Porta banda del grup, mediana, marques de mandat i
 *     llegenda. És la que ocupa una secció sencera.
 *   - `mitjana`: 720×180, amb menys marques i menys anys escrits i sense
 *     llegenda. Per a tot allò que avui és una taula de cinc files o una
 *     espurna que es queda curta.
 *   - `espurna`: 118×34, sense eixos ni etiquetes. **Només** dins d'una
 *     targeta que ja escriu la xifra: sense la xifra al costat, una línia sense
 *     escala no diu res.
 */
export type MidaSerie = "gran" | "mitjana" | "espurna";

export type OpcionsSerie = {
  /** Com s'escriu un valor: «1.204 €», «38,5 %»… */
  format: (valor: number) => string;
  /** Què es dibuixa, per a l'etiqueta de l'eix i per al text alternatiu. */
  titol: string;
  /** Quant de lloc ocupa. Per defecte, la gran de sempre. */
  mida?: MidaSerie;
  /** La banda del grup de mida, si se'n té. */
  banda?: readonly BandaGrup[];
  /** Com es diu el grup: «de 20.001 a 50.000 habitants». */
  grup?: string | null;
  /** Els mandats que travessa la sèrie, marcats amb una línia i una etiqueta. */
  mandats?: readonly TramMandat[];
  /**
   * Els anys que la font havia de donar, tant si els dona com si no.
   *
   * Sense això, un any que la font no publica desapareix i la línia el salta
   * com si no hagués existit mai: el 2020 de la liquidació d'un ajuntament que
   * no va liquidar es llegia com un any normal entre el 2019 i el 2021. Amb la
   * llista del que s'esperava, el forat es dibuixa —cercle buit i línia
   * partida— i es compta a la taula com a «sense dada». Un forat s'ha de veure
   * com un forat.
   */
  anysEsperats?: readonly number[];
  /**
   * Fals per als valors que poden ser negatius o que no tenen un zero
   * significatiu. Per defecte l'eix comença a zero, que és el que impedeix
   * convertir una variació petita en un espant.
   */
  desDeZero?: boolean;
};

const AMPLE = 720;
const ALT = 300;
const MARGE = { dalt: 18, dreta: 14, baix: 46, esquerra: 62 } as const;

/** Un nombre net per a l'SVG: dos decimals i prou. */
const n2 = (v: number): string => (Math.round(v * 100) / 100).toString();

/** Tot el que canvia entre una mida i una altra, i entre ample i estret. */
type Disseny = {
  ample: number;
  alt: number;
  marge: { dalt: number; dreta: number; baix: number; esquerra: number };
  /** Quantes divisions se li demanen a l'eix vertical. */
  marques: number;
  /** Quants anys s'escriuen a l'eix horitzontal. */
  anys: number;
  /** Si hi ha graella, eix i xifres. L'espurna no en té cap. */
  eix: boolean;
  /** Les xifres de l'eix damunt de la seva ratlla, en comptes de al marge. */
  etiquetesDalt: boolean;
  /** Si es dibuixa la banda del grup i la seva mediana. */
  fons: boolean;
  mandats: "tots" | "primer-canvi" | "cap";
  nusos: "tots" | "ultim";
  /** El radi del punt de cada any. A la mitjana la tinta es fa nosa abans. */
  radiNus: number;
  /** Si al peu hi va la clau de colors. */
  llegenda: boolean;
  /** Si en surt una segona versió per a sota de 480 px. */
  respon: boolean;
};

const DISSENYS: Record<MidaSerie, Disseny> = {
  gran: {
    ample: AMPLE,
    alt: ALT,
    marge: { ...MARGE },
    marques: 4,
    anys: 7,
    eix: true,
    etiquetesDalt: false,
    fons: true,
    mandats: "tots",
    nusos: "tots",
    radiNus: 3.4,
    llegenda: true,
    respon: true,
  },
  mitjana: {
    ample: AMPLE,
    alt: 180,
    marge: { dalt: 14, dreta: 14, baix: 34, esquerra: MARGE.esquerra },
    marques: 3,
    anys: 5,
    eix: true,
    etiquetesDalt: false,
    fons: true,
    mandats: "tots",
    nusos: "tots",
    radiNus: 3,
    llegenda: false,
    respon: true,
  },
  espurna: {
    ample: 118,
    alt: 34,
    // El marge no és decoració: el cercle del darrer punt fa 3 de radi i encara
    // hi posa el gruix del contorn a sobre. Amb menys de 5, en surt escapçat.
    marge: { dalt: 5, dreta: 5, baix: 5, esquerra: 5 },
    marques: 0,
    anys: 0,
    eix: false,
    etiquetesDalt: false,
    fons: false,
    mandats: "cap",
    nusos: "ultim",
    radiNus: 3,
    llegenda: false,
    respon: false,
  },
};

/**
 * El mateix gràfic per a una finestra estreta.
 *
 * A 375 px, el dibuix de 720 unitats es veu a mitja mida: el marge esquerre de
 * 62 unitats són 31 px reals que no dibuixen res, cinc marques verticals es
 * toquen i cada canvi de mandat escriu un cognom damunt de l'altre. Es retalla
 * el que sobra i es guarda el que informa. Les xifres de l'eix passen a sobre
 * de la seva ratlla perquè al marge de 40 no hi caben: «1.204 €» en vol 45.
 */
const estret = (d: Disseny): Disseny => ({
  ...d,
  marge: { ...d.marge, esquerra: 40 },
  marques: 3,
  anys: 4,
  etiquetesDalt: true,
  mandats: d.mandats === "cap" ? "cap" : "primer-canvi",
});

/**
 * Marques de l'eix vertical: quatre o cinc, en xifres rodones.
 *
 * Un eix amb marques a 0, 247, 494 i 741 és tècnicament correcte i no el
 * llegeix ningú. Es busca el pas «bonic» —1, 2, 2,5 o 5 per una potència de
 * deu— més petit que en doni com a molt cinc.
 */
export function marquesEix(min: number, max: number, quantes = 4): number[] {
  if (!(max > min)) return [min];
  const brut = (max - min) / quantes;
  const magnitud = 10 ** Math.floor(Math.log10(brut));
  const ambPas = (pas: number): number[] => {
    const out: number[] = [];
    for (let v = Math.ceil(min / pas - 1e-9) * pas; v <= max + pas * 1e-9; v += pas) {
      // `Math.ceil(-1e-9) * pas` és **−0**, i un eix que comença a «−0 €» és una
      // errada que no es veu fins que algú la llegeix a la pàgina.
      const marca = Math.round(v * 1e6) / 1e6;
      out.push(marca === 0 ? 0 : marca);
    }
    return out;
  };
  // Es prova cada pas «bonic» i es queda el que dona un nombre de marques més a
  // prop del que s'ha demanat. Agafar el primer pas més gran que el brut, que és
  // el que es fa sovint, deixava un eix de 0 a 4.200 amb tres marques —0, 2.000
  // i 4.000— quan amb 1.000 en surten cinc i es llegeix molt millor.
  const candidats = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25].map((m) => m * magnitud);
  let millor = ambPas(candidats[candidats.length - 1]!);
  let distancia = Infinity;
  for (const pas of candidats) {
    const marques = ambPas(pas);
    if (marques.length < 2 || marques.length > 9) continue;
    const d = Math.abs(marques.length - (quantes + 1));
    if (d < distancia || (d === distancia && marques.length < millor.length)) {
      millor = marques;
      distancia = d;
    }
  }
  return millor;
}

/**
 * Quins anys es poden escriure a l'eix sense que es trepitgin.
 *
 * Amb onze anys i 320 px d'amplada, escriure'ls tots vol dir un mur de xifres
 * il·legible. Es queden el primer, l'últim i els que caben pel mig amb un pas
 * regular; els altres continuen tenint la seva marca, que és el que fa veure
 * que la sèrie no té forats.
 */
export function anysVisibles(anys: readonly number[], maxim = 7): number[] {
  if (anys.length <= maxim) return [...anys];
  const pas = Math.ceil((anys.length - 1) / (maxim - 1));
  const tria = anys.filter((_, i) => i % pas === 0);
  const ultim = anys[anys.length - 1]!;
  if (tria[tria.length - 1] !== ultim) tria.push(ultim);
  return tria;
}

/**
 * La sèrie d'un municipi amb la meitat central del seu grup al darrere.
 *
 * La banda és el que converteix una foto en un judici, que és exactament el que
 * demanava el pla de dades: 1.204 € de deute per habitant no vol dir res sol, i
 * vol dir molt quan es veu que els municipis de la seva mida es mouen entre 300
 * i 800 i que ell fa deu anys que hi és per sobre.
 *
 * Torna cadena buida amb menys de dos punts: una ratxa d'un sol punt dibuixada
 * com una línia és una tendència inventada.
 */
export function serieTemporal(punts: readonly PuntSerie[], opcions: OpcionsSerie): string {
  const serie = [...punts].sort((a, b) => a.any - b.any);
  if (serie.length < 2) return "";

  const mida = opcions.mida ?? "gran";
  const base = DISSENYS[mida];

  // --- els anys: els que la font dona i els que havia de donar
  const anysAmbDada = new Set(serie.map((p) => p.any));
  const esperats = [...new Set(opcions.anysEsperats ?? [])].sort((a, b) => a - b);
  const anyMin = Math.min(serie[0]!.any, ...esperats);
  const anyMax = Math.max(serie[serie.length - 1]!.any, ...esperats);
  const forats = esperats.filter((any) => !anysAmbDada.has(any));
  const anysEix = [...new Set([...serie.map((p) => p.any), ...forats])].sort((a, b) => a - b);

  const banda = base.fons ? (opcions.banda ?? []).filter((b) => b.any >= anyMin && b.any <= anyMax) : [];
  const capBanda = banda.length >= 2;
  const desDeZero = opcions.desDeZero ?? true;

  const valors = [...serie.map((p) => p.valor), ...banda.flatMap((b) => [b.p25, b.p50, b.p75])];
  const brutMax = Math.max(...valors);
  const brutMin = Math.min(...valors);
  // L'espurna no té eix, i per tant no hi ha cap zero per ensenyar ni cap escala
  // per llegir: el que diu és **com** s'ha mogut la sèrie, i el quant és la
  // xifra que té al costat a la targeta. Ficar-hi el zero només l'aplanaria
  // fins a fer-la inútil. La resta de mides sí que comencen a zero.
  const zeroSignificatiu = base.eix && desDeZero && brutMin >= 0;
  const min = zeroSignificatiu ? 0 : brutMin - (brutMax - brutMin) * 0.08;
  const max = brutMax + (brutMax - min) * 0.08 || 1;

  const primer = serie[0]!;
  const ultim = serie[serie.length - 1]!;
  // Els anys que falten es diuen al text alternatiu, no només al dibuix: qui no
  // veu el cercle buit ha de saber igualment que hi ha un any sense xifra.
  const llistaForats =
    forats.length <= 1
      ? forats.join("")
      : `${forats.slice(0, -1).join(", ")} i ${forats[forats.length - 1]}`;
  const resum = `${escape(opcions.titol)}: de ${escape(opcions.format(primer.valor))} el ${primer.any} a ${escape(
    opcions.format(ultim.valor),
  )} el ${ultim.any}.${
    forats.length > 0
      ? ` ${forats.length === 1 ? "De l'any" : "Dels anys"} ${llistaForats} no en consta cap xifra.`
      : ""
  }`;

  /**
   * Un dibuix sencer, per a una amplada de pantalla.
   *
   * Surt dues vegades —l'ample i l'estret— i el CSS n'ensenya un a cada mida.
   * Un SVG no pot canviar de `viewBox` amb una consulta de mitjans i el marge
   * esquerre, les marques i els anys escrits han de canviar de veritat, no
   * només amagar-se: el que es guanya a l'esquerra és amplada de dibuix.
   */
  const dibuix = (d: Disseny, classe: string): string => {
    const x = (any: number): number =>
      anyMax === anyMin
        ? d.marge.esquerra
        : d.marge.esquerra + ((any - anyMin) / (anyMax - anyMin)) * (d.ample - d.marge.esquerra - d.marge.dreta);
    const y = (valor: number): number =>
      max === min
        ? (d.alt - d.marge.baix + d.marge.dalt) / 2
        : d.alt - d.marge.baix - ((valor - min) / (max - min)) * (d.alt - d.marge.dalt - d.marge.baix);
    const terra = d.alt - d.marge.baix;

    // --- la banda del grup, i la seva mediana
    let bandaSvg = "";
    if (capBanda) {
      const dalt = banda.map((b) => `${n2(x(b.any))} ${n2(y(b.p75))}`);
      const baix = [...banda].reverse().map((b) => `${n2(x(b.any))} ${n2(y(b.p25))}`);
      const mediana = banda.map((b, i) => `${i === 0 ? "M" : "L"}${n2(x(b.any))} ${n2(y(b.p50))}`).join(" ");
      bandaSvg = `<path class="banda" d="M${dalt.join(" L")} L${baix.join(" L")} Z"/>
      <path class="mediana-grup" d="${mediana}"/>`;
    }

    // --- els eixos
    let graella = "";
    let eixX = "";
    let eix = "";
    if (d.eix) {
      graella = marquesEix(min, max, d.marques)
        .map((v) => {
          const ratlla = `<line class="graella" x1="${d.marge.esquerra}" x2="${d.ample - d.marge.dreta}" y1="${n2(y(v))}" y2="${n2(y(v))}"/>`;
          const xifra = escape(opcions.format(v));
          // Al marge de 40 no hi cap «1.204 €», i una xifra que surt del dibuix
          // per l'esquerra és pitjor que una xifra a sobre de la seva ratlla.
          return d.etiquetesDalt
            ? `${ratlla}<text class="etiqueta-eix" x="0" y="${n2(y(v) - 5)}">${xifra}</text>`
            : `${ratlla}<text class="etiqueta-eix" x="${d.marge.esquerra - 8}" y="${n2(y(v) + 4)}" text-anchor="end">${xifra}</text>`;
        })
        .join("");

      const escrits = new Set(anysVisibles(anysEix, d.anys));
      eixX = anysEix
        .map((any) => {
          const marca = `<line class="marca-any" x1="${n2(x(any))}" x2="${n2(x(any))}" y1="${terra}" y2="${terra + 5}"/>`;
          if (!escrits.has(any)) return marca;
          return `${marca}<text class="etiqueta-eix" x="${n2(x(any))}" y="${terra + 19}" text-anchor="middle">${any}</text>`;
        })
        .join("");

      eix = `<line class="eix" x1="${d.marge.esquerra}" x2="${d.ample - d.marge.dreta}" y1="${terra}" y2="${terra}"/>`;
    }

    // --- els mandats: una ratlla vertical on comença cadascun, amb qui hi havia
    const dins = d.mandats === "cap" ? [] : (opcions.mandats ?? []).filter((m) => m.desDe > anyMin && m.desDe <= anyMax);
    // Quan qui governa repeteix, el nom repetit no diu res de nou i només fa
    // soroll damunt de la línia. La ratlla sí que hi va: marca on comença un
    // mandat, i que el mateix nom governi els dos es veu perquè no n'hi ha cap
    // altre entremig.
    const canvia = (m: TramMandat, i: number): boolean =>
      m.etiqueta !== "" && m.etiqueta !== (i === 0 ? null : dins[i - 1]!.etiqueta);
    const primerCanvi = dins.findIndex(canvia);
    const mandats = dins
      .map((m, i) => {
        const linia = `<line class="tall-mandat" x1="${n2(x(m.desDe))}" x2="${n2(x(m.desDe))}"
        y1="${d.marge.dalt}" y2="${terra}"/>`;
        const escriu = d.mandats === "tots" ? canvia(m, i) : i === primerCanvi;
        if (!escriu) return linia;
        // A prop del final, un cognom escrit cap a la dreta se'n va fora del
        // dibuix. Allà s'ancora a l'altra banda de la seva ratlla.
        const alFinal = x(m.desDe) > d.ample * 0.68;
        return `${linia}<text class="etiqueta-mandat" x="${n2(alFinal ? x(m.desDe) - 5 : x(m.desDe) + 5)}" y="${d.marge.dalt + 11}"${
          alFinal ? ' text-anchor="end"' : ""
        }>${escape(m.etiqueta)}</text>`;
      })
      .join("");

    // --- els forats: els anys que la font havia de donar i no dona
    const foratsSvg = forats
      .map(
        (any) => `<line class="buit" x1="${n2(x(any))}" x2="${n2(x(any))}" y1="${d.marge.dalt}" y2="${terra}"/>
      <circle class="forat" cx="${n2(x(any))}" cy="${n2((d.marge.dalt + terra) / 2)}" r="${d.eix ? 4 : 2.6}"/>`,
      )
      .join("");

    // --- la línia del municipi, partida allà on falta un any
    // Passar per damunt d'un any que sabem que falta seria dibuixar una dada que
    // ningú no ha publicat: la línia s'atura i torna a començar a l'altra banda.
    const trams: PuntSerie[][] = [];
    for (const p of serie) {
      const tram = trams[trams.length - 1];
      const anterior = tram?.[tram.length - 1];
      if (tram && anterior && !forats.some((f) => f > anterior.any && f < p.any)) tram.push(p);
      else trams.push([p]);
    }
    const linia = trams
      .filter((t) => t.length >= 2)
      .map((t) => t.map((p, i) => `${i === 0 ? "M" : "L"}${n2(x(p.any))} ${n2(y(p.valor))}`).join(" "))
      .join(" ");

    const nusos =
      d.nusos === "ultim"
        ? ""
        : serie.map((p) => `<circle class="nus" cx="${n2(x(p.any))}" cy="${n2(y(p.valor))}" r="${d.radiNus}"/>`).join("");

    return `<svg class="dibuix ${classe}" viewBox="0 0 ${d.ample} ${d.alt}" role="img" aria-label="${resum}"
      preserveAspectRatio="xMidYMid meet">
      ${graella}
      ${bandaSvg}
      ${mandats}
      ${foratsSvg}
      ${eix}
      ${eixX}
      <path class="linia" d="${linia}"/>
      ${nusos}
      <circle class="nus ara" cx="${n2(x(ultim.any))}" cy="${n2(y(ultim.valor))}" r="${d.eix ? d.radiNus + 2 : 3}"/>
    </svg>`;
  };

  /**
   * L'equivalent en text, que no és una nota al peu sinó la mateixa dada.
   *
   * Va dins d'un div i la classe d'amagar la porta el div, no la taula. Amagada
   * amb la classe posada a sobre seu, la taula es quedava a 649 px d'ample —una
   * taula no es creu l'amplada d'un píxel— i, tot i ser invisible, allargava
   * l'amplada de desplaçament del document: a 555 px de finestra la fitxa en
   * feia 673 i lliscava de costat sense que es veiés res que l'empenyés. I n'hi
   * ha una per gràfica.
   */
  const taula = `<div class="nomes-lectors"><table>
    <caption>${escape(opcions.titol)}${opcions.grup ? `, amb la meitat central dels municipis ${escape(opcions.grup)}` : ""}</caption>
    <thead><tr><th scope="col">Any</th><th scope="col">${escape(opcions.titol)}</th>
    ${capBanda ? "<th scope=\"col\">Mediana del grup</th>" : ""}</tr></thead>
    <tbody>${anysEix
      .map((any) => {
        const p = serie.find((q) => q.any === any);
        const b = banda.find((x2) => x2.any === any);
        return `<tr><th scope="row">${any}</th><td>${p ? escape(opcions.format(p.valor)) : "sense dada"}</td>
        ${capBanda ? `<td>${b ? escape(opcions.format(b.p50)) : "sense dada"}</td>` : ""}</tr>`;
      })
      .join("")}</tbody></table></div>`;

  const clau = [
    base.llegenda && capBanda
      ? `<span class="mostra mostra-linia"></span> aquest municipi
      <span class="mostra mostra-banda"></span> la meitat central dels municipis ${escape(opcions.grup ?? "de la seva mida")}
      <span class="mostra mostra-mediana"></span> la seva mediana`
      : "",
    base.eix && forats.length > 0
      ? `<span class="mostra mostra-forat"></span> ${
          forats.length === 1 ? "l'any que la font no publica" : "els anys que la font no publica"
        }`
      : "",
  ]
    .filter((t) => t !== "")
    .join(" ");

  const dibuixos = base.respon
    ? `${dibuix(base, "ample")}
    ${dibuix(estret(base), "estret")}`
    : dibuix(base, "unic");

  return `<figure class="grafic serie serie-${mida}">
    ${dibuixos}
    ${clau === "" ? "" : `<figcaption class="clau-grafic">${clau}</figcaption>`}
    ${zeroSignificatiu || !base.eix ? "" : `<p class="compta">L'eix no comença a zero: aquesta xifra pot ser negativa i el zero no en marca cap límit.</p>`}
    ${taula}
  </figure>`;
}

/** Els dos extrems d'un salt: d'on ve un valor i on ha anat a parar. */
export type SaltPendent = { inici: number; final: number };

export type OpcionsPendent = {
  /** Què es mesura: «Deute per habitant». */
  titol: string;
  /** De qui és la fila, si el dibuix no va acompanyat del nom: «Sabadell». */
  etiqueta?: string | null;
  format: (valor: number) => string;
  /** Els dos anys que es comparen. */
  anys: SaltPendent;
  /** El salt del municipi. */
  municipi: SaltPendent;
  /** El mateix salt al grup de comparació, si se'n té. */
  grup?: SaltPendent | null;
  /** Com es diu el grup, per a la taula i el text. */
  nomGrup?: string | null;
  /**
   * L'escala compartida per tota la llista.
   *
   * Si es dibuixa una fila per municipi, **totes han de portar la mateixa**:
   * dos dibuixos amb escales diferents posats un sota l'altre es llegeixen com
   * si es poguessin comparar, i és exactament l'engany que prohibeix la regla 2
   * del capçal. Sense escala, cada dibuix es fa la seva i només serveix sol.
   */
  escala?: { min: number; max: number } | null;
};

const AMPLE_P = 300;
const ALT_P = 56;
/** Lloc per al cercle i per a la xifra que hi va a sobre, a banda i banda. */
const MARGE_P = 30;

/**
 * El salt d'una xifra entre dos anys, en una fila de 300×56.
 *
 * Això substitueix una taula de cinc columnes —municipi, any vell, any nou,
 * variació i grup— que ningú no llegia sencera: per veure qui s'ha mogut més
 * calia restar vint parells de números de cap. Amb el dibuix, el que és llarg
 * és llarg i el que va enrere va enrere, i es veu de reüll.
 *
 * La posició diu **el valor** (no l'any): el cercle buit és d'on venia i el
 * cercle de coral és on és ara, que és el color que la fitxa fa servir sempre
 * per a «tu ets aquí». A sota, amb traça fina i discontínua, el mateix salt del
 * grup: si tothom ha pujat, haver pujat no és cap notícia.
 *
 * Els dos anys no s'escriuen a dins. En una llista de files són sempre els
 * mateixos i es diuen un cop al capçal; a dins hi caben les xifres, que sí que
 * canvien de fila en fila. La taula amagada els porta igualment.
 */
export function pendent(opcions: OpcionsPendent): string {
  const { municipi, grup, format } = opcions;
  const propis = [municipi.inici, municipi.final];
  const tots = [...propis, ...(grup ? [grup.inici, grup.final] : [])];
  if (tots.some((v) => !Number.isFinite(v))) return "";

  const min = opcions.escala?.min ?? Math.min(...tots);
  const max = opcions.escala?.max ?? Math.max(...tots);
  // Un valor que cau fora de l'escala que ha passat qui crida es dibuixa al
  // límit: val més un dibuix que toca la vora que un cercle fora del quadre.
  // La xifra de debò és a la taula, que és la que mana.
  const x = (v: number): number =>
    max <= min
      ? AMPLE_P / 2
      : MARGE_P +
        ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * (AMPLE_P - 2 * MARGE_P);

  const CARRIL_MUNICIPI = 24;
  const CARRIL_GRUP = 42;
  const carril = (y: number, classe: string): string =>
    `<line class="carril ${classe}" x1="${MARGE_P}" x2="${AMPLE_P - MARGE_P}" y1="${y}" y2="${y}"/>`;

  const xi = x(municipi.inici);
  const xf = x(municipi.final);
  // Les dues xifres a sobre només hi caben si els cercles no s'encavalquen; si
  // el salt és curt, es queda la d'ara, que és la que la fila explica.
  const capAbans = Math.abs(xf - xi) >= 56;
  const aDins = (v: number): string => n2(Math.max(26, Math.min(AMPLE_P - 26, v)));
  const xifres = `${
    capAbans
      ? `<text class="xifra abans" x="${aDins(xi)}" y="12" text-anchor="middle">${escape(format(municipi.inici))}</text>`
      : ""
  }<text class="xifra ara" x="${aDins(xf)}" y="12" text-anchor="middle">${escape(format(municipi.final))}</text>`;

  const grupSvg = grup
    ? `${carril(CARRIL_GRUP, "carril-grup")}
      <line class="salt-grup" x1="${n2(x(grup.inici))}" x2="${n2(x(grup.final))}" y1="${CARRIL_GRUP}" y2="${CARRIL_GRUP}"/>
      <circle class="cap-inici grup" cx="${n2(x(grup.inici))}" cy="${CARRIL_GRUP}" r="3"/>
      <circle class="cap-final grup" cx="${n2(x(grup.final))}" cy="${CARRIL_GRUP}" r="3.2"/>`
    : "";

  const nom = opcions.etiqueta ? `${escape(opcions.etiqueta)}, ` : "";
  const resum = `${nom}${escape(opcions.titol)}: de ${escape(format(municipi.inici))} el ${opcions.anys.inici} a ${escape(
    format(municipi.final),
  )} el ${opcions.anys.final}.${
    grup
      ? ` Els municipis ${escape(opcions.nomGrup ?? "del seu grup")}, de ${escape(format(grup.inici))} a ${escape(
          format(grup.final),
        )}.`
      : ""
  }`;

  const capGrup = grup ? `<th scope="col">${escape(opcions.nomGrup ?? "El seu grup")}</th>` : "";
  const fila = (any: number, propi: number, delGrup: number | null): string =>
    `<tr><th scope="row">${any}</th><td>${escape(format(propi))}</td>${
      delGrup === null ? "" : `<td>${escape(format(delGrup))}</td>`
    }</tr>`;
  const taula = `<div class="nomes-lectors"><table>
    <caption>${nom}${escape(opcions.titol)}</caption>
    <thead><tr><th scope="col">Any</th><th scope="col">${escape(opcions.titol)}</th>${capGrup}</tr></thead>
    <tbody>${fila(opcions.anys.inici, municipi.inici, grup ? grup.inici : null)}
    ${fila(opcions.anys.final, municipi.final, grup ? grup.final : null)}</tbody></table></div>`;

  return `<figure class="grafic pendent">
    <svg class="dibuix unic" viewBox="0 0 ${AMPLE_P} ${ALT_P}" role="img" aria-label="${resum}"
      preserveAspectRatio="xMidYMid meet">
      ${carril(CARRIL_MUNICIPI, "carril-municipi")}
      ${grupSvg}
      ${xifres}
      <line class="salt" x1="${n2(xi)}" x2="${n2(xf)}" y1="${CARRIL_MUNICIPI}" y2="${CARRIL_MUNICIPI}"/>
      <circle class="cap-inici" cx="${n2(xi)}" cy="${CARRIL_MUNICIPI}" r="4.5"/>
      <circle class="cap-final" cx="${n2(xf)}" cy="${CARRIL_MUNICIPI}" r="5"/>
    </svg>
    ${taula}
  </figure>`;
}

/**
 * On cau aquest municipi dins del seu grup, ensenyant **la forma** del grup.
 *
 * Fins ara això es deia amb un regle de 0 a 100, una marca a la mediana i una
 * frase. Amb això, un municipi al percentil 70 d'un grup molt atapeït i un al
 * percentil 70 d'un grup on la meitat està a un extrem es llegeixen igual, i no
 * són el mateix: al primer, set punts amunt el posarien a la cua; al segon, no
 * el mourien. La forma és la informació que faltava.
 *
 * S'hi dibuixa un histograma i no una tira de punts perquè amb dos-cents
 * noranta municipis els punts es tapen entre ells i el que sembla poc dens és
 * només el que està menys apilat. Les barres no s'aparten: compten.
 *
 * Torna cadena buida amb un grup massa petit: una distribució de vuit valors és
 * una anècdota dibuixada com si fos una llei.
 */
export function distribucioGrup(
  valors: readonly number[],
  valor: number,
  opcions: { format: (valor: number) => string; titol: string; grup: string; unitat: string },
): string {
  const MINIM = 12;
  if (valors.length < MINIM) return "";
  const ordenats = [...valors].sort((a, b) => a - b);
  const min = ordenats[0]!;
  const max = ordenats[ordenats.length - 1]!;
  if (!(max > min)) return "";

  const AMPLE_D = 720;
  const ALT_D = 132;
  const BAIX = 34;
  const DALT = 10;
  const caselles = Math.min(24, Math.max(8, Math.round(Math.sqrt(ordenats.length))));
  const pas = (max - min) / caselles;
  const compte = new Array<number>(caselles).fill(0);
  const casellaDe = (v: number): number => Math.min(caselles - 1, Math.floor((v - min) / pas));
  for (const v of ordenats) compte[casellaDe(v)] = (compte[casellaDe(v)] ?? 0) + 1;
  const alt = Math.max(...compte);
  const meva = casellaDe(Math.max(min, Math.min(max, valor)));

  const x = (v: number): number => ((v - min) / (max - min)) * AMPLE_D;
  const barres = compte
    .map((quants, i) => {
      const x0 = (i / caselles) * AMPLE_D;
      const ample = AMPLE_D / caselles;
      const alçada = (quants / alt) * (ALT_D - BAIX - DALT);
      return `<rect class="casella${i === meva ? " meva" : ""}" x="${n2(x0 + 0.8)}" y="${n2(ALT_D - BAIX - alçada)}"
        width="${n2(ample - 1.6)}" height="${n2(Math.max(quants > 0 ? 1.5 : 0, alçada))}"/>`;
    })
    .join("");

  const mediana = ordenats[Math.floor((ordenats.length - 1) / 2)]!;
  const perSota = ordenats.filter((v) => v < valor).length;
  // La fletxa fa cinc unitats d'ample cap a cada banda: si la punta es clava a
  // la vora, l'ala esquerra se'n va fora del quadre. Per això no baixa de 6.
  const puntaFletxa = Math.max(6, Math.min(AMPLE_D - 6, x(valor)));

  return `<figure class="grafic distribucio">
    <svg viewBox="0 0 ${AMPLE_D} ${ALT_D}" role="img" preserveAspectRatio="xMidYMid meet"
      aria-label="${escape(opcions.titol)}: ${escape(opcions.format(valor))}. ${perSota} dels ${
        ordenats.length
      } municipis ${escape(opcions.grup)} en tenen menys, i la mediana és ${escape(opcions.format(mediana))}.">
      ${barres}
      <line class="mediana-grup" x1="${n2(x(mediana))}" x2="${n2(x(mediana))}" y1="${DALT}" y2="${ALT_D - BAIX}"/>
      <line class="eix" x1="0" x2="${AMPLE_D}" y1="${ALT_D - BAIX}" y2="${ALT_D - BAIX}"/>
      <text class="etiqueta-eix" x="0" y="${ALT_D - BAIX + 17}">${escape(opcions.format(min))}</text>
      <text class="etiqueta-eix" x="${AMPLE_D}" y="${ALT_D - BAIX + 17}" text-anchor="end">${escape(opcions.format(max))}</text>
      <text class="etiqueta-aqui" x="${n2(Math.max(46, Math.min(AMPLE_D - 46, x(valor))))}" y="${ALT_D - 6}"
        text-anchor="middle">${escape(opcions.format(valor))}</text>
      <path class="fletxa-aqui" d="M${n2(puntaFletxa)} ${ALT_D - BAIX + 2}
        l-5 8 h10 Z"/>
    </svg>
    <figcaption class="clau-grafic">${perSota} dels ${ordenats.length} municipis ${escape(opcions.grup)}
    en tenen menys${opcions.unitat ? ` ${escape(opcions.unitat)}` : ""}; la mediana del grup és
    ${escape(opcions.format(mediana))}.</figcaption>
  </figure>`;
}


// ─────────────────────────────────────────────────────────────────────────────
// Barres divergents: un canvi per fila, amb el zero al mig
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila de les barres divergents: què ha canviat, quant, i quant als seus. */
export type FilaDivergent = {
  etiqueta: string;
  /** El canvi d'aquest municipi. Pot ser negatiu, i pot ser zero. */
  valor: number;
  /** El mateix canvi al grup de comparació, o `null` si no se'n té. */
  grup: number | null;
  /** On porta l'etiqueta, si porta enlloc: l'àncora del bloc que ho explica. */
  enllac?: string;
};

export type OpcionsDivergents = {
  /** Què es mesura: «Canvi de la despesa per habitant, servei a servei». */
  titol: string;
  /** Com s'escriu un valor **en valor absolut**: el signe el posa el dibuix. */
  format: (valor: number) => string;
  /** La unitat, escrita després de cada xifra: «€/hab». */
  unitat?: string;
  /** Com es diu el grup: «de 20.001 a 50.000 habitants». */
  nomGrup?: string | null;
  /**
   * L'escala compartida: el valor absolut que ocupa tota la meitat del canal.
   *
   * Si una llista es parteix en dues —les vuit files més grans a la vista i
   * la resta plegades— **totes dues han de rebre la mateixa**: dos dibuixos
   * amb escales diferents posats un sota l'altre es llegeixen com si es
   * poguessin comparar, i és l'engany que prohibeix la regla 2 del capçal.
   * Sense escala, es pren el valor absolut més gran de la llista, grup inclòs.
   */
  escala?: number;
};

/** El signe tipogràfic: el menys de debò, no el guionet. */
const signe = (n: number): string => (n > 0 ? "+" : n < 0 ? "−" : "");

/**
 * El valor absolut més gran d'una llista de files, grup inclòs.
 *
 * És l'escala que fa servir `barresDivergents` quan no se n'hi passa cap, i
 * es publica perquè qui parteixi la llista en dues la pugui calcular sobre la
 * llista sencera i passar-la a totes dues crides.
 */
export function escalaDivergent(files: readonly FilaDivergent[]): number {
  const maxim = Math.max(0, ...files.flatMap((f) => [Math.abs(f.valor), f.grup === null ? 0 : Math.abs(f.grup)]));
  return maxim > 0 ? maxim : 1;
}

/**
 * Un canvi per fila, dibuixat com una barra que surt del zero cap a una banda
 * o cap a l'altra, amb el mateix canvi al grup marcat com una ratlla grisa.
 *
 * Substitueix una llista de divuit files de text —«+13,7 €/hab, de 71 el 2023
 * a 85 el 2025, als 20 de la seva mida +8,1»— que s'havia de llegir fila per
 * fila per saber on han posat els diners. Amb el zero al mig, el que ha
 * crescut va a la dreta i el que ha baixat a l'esquerra, i es veu de reüll
 * quines partides s'han mogut i quines no.
 *
 * Tres decisions, i per què:
 *
 *   · **Una sola tinta.** La barra va sempre de lavanda, tant si puja com si
 *     baixa: el sentit el diu la posició respecte del zero, i pintar les
 *     pujades d'un color i les baixades d'un altre seria posar-hi un
 *     veredicte —gastar més en un servei no és ni bo ni dolent— amb el
 *     verd i el vermell que la metodologia prohibeix.
 *   · **La xifra sempre escrita.** «design/MOVIMENT.md»: una barra sola no
 *     és una dada llegible. Cada fila porta el número al costat, amb el signe
 *     i la unitat, i el del grup en petit a sota.
 *   · **El zero al 50 %.** L'escala és simètrica encara que totes les files
 *     vagin cap a la mateixa banda: si el zero es mogués per aprofitar
 *     l'espai, dues llistes de la mateixa pàgina no es podrien comparar.
 *
 * La llista visible és el dibuix i va amagada a la lectura amb veu, com els
 * SVG de la resta del mòdul; la dada per a qui llegeix amb veu és la taula
 * de sota, amagada als ulls, que porta els mateixos enllaços. Quan el teclat
 * hi entra, la taula es fa visible: un enllaç que rep el focus no pot ser
 * invisible.
 */
export function barresDivergents(files: readonly FilaDivergent[], opcions: OpcionsDivergents): string {
  if (files.length === 0) return "";
  const escala = opcions.escala !== undefined && opcions.escala > 0 ? opcions.escala : escalaDivergent(files);
  const unitat = opcions.unitat ? ` ${opcions.unitat}` : "";
  const xifra = (v: number): string => `${signe(v)}${opcions.format(Math.abs(v))}${unitat}`;
  // Un valor més gran que l'escala que ha passat qui crida es dibuixa fins a
  // la vora i no més enllà del canal: la xifra de debò és escrita al costat.
  const dins = (n: number): number => Math.max(0, Math.min(100, n));
  const ambGrup = files.some((f) => f.grup !== null);

  const nom = (f: FilaDivergent, focusable: boolean): string =>
    f.enllac
      ? `<a href="${escape(f.enllac)}"${focusable ? "" : ' tabindex="-1"'}>${escape(f.etiqueta)}</a>`
      : escape(f.etiqueta);

  const llista = files
    .map((f) => {
      const sentit = f.valor > 0 ? "positiu" : f.valor < 0 ? "negatiu" : "zero";
      const w = dins((50 * Math.abs(f.valor)) / escala);
      const marca =
        f.grup === null
          ? ""
          : `<b class="marca-grup" style="--m:${n2(dins(50 + (50 * f.grup) / escala))}%"></b>`;
      const delGrup = f.grup === null ? "" : `<span class="del-grup">seus ${xifra(f.grup)}</span>`;
      return `<li class="${sentit}">
      <span class="etq">${nom(f, false)}</span>
      <span class="canal"><i class="barra" style="--w:${n2(w)}%"></i>${marca}</span>
      <span class="xifres"><b class="xifra">${xifra(f.valor)}</b>${delGrup}</span>
    </li>`;
    })
    .join("");

  const capGrup = ambGrup ? `<th scope="col">${escape(opcions.nomGrup ? `Municipis ${opcions.nomGrup}` : "El seu grup")}</th>` : "";
  const taula = `<div class="nomes-lectors"><table>
    <caption>${escape(opcions.titol)}${ambGrup && opcions.nomGrup ? `, amb el mateix canvi als municipis ${escape(opcions.nomGrup)}` : ""}</caption>
    <thead><tr><th scope="col">Què</th><th scope="col">${escape(opcions.titol)}</th>${capGrup}</tr></thead>
    <tbody>${files
      .map(
        (f) => `<tr><th scope="row">${nom(f, true)}</th><td>${xifra(f.valor)}</td>${
          ambGrup ? `<td>${f.grup === null ? "sense dada" : xifra(f.grup)}</td>` : ""
        }</tr>`,
      )
      .join("")}</tbody></table></div>`;

  const clau = `<span class="mostra mostra-zero"></span> el zero
    <span class="mostra mostra-barra"></span> aquest municipi${
      ambGrup ? ` <span class="mostra mostra-tick"></span> el mateix canvi als municipis ${escape(opcions.nomGrup ?? "de la seva mida")}` : ""
    }`;

  return `<figure class="grafic divergents">
    <ul class="barres-divergents" aria-hidden="true">${llista}</ul>
    <figcaption class="clau-grafic">${clau}</figcaption>
    ${taula}
  </figure>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// El regle de dispersió: una marca per municipi, del més baix al més alt
// ─────────────────────────────────────────────────────────────────────────────

/** Una marca del regle: un valor, de qui és i si és el «tu ets aquí». */
export type ValorDispersio = {
  valor: number;
  /** El nom del municipi. Buit quan la font només dona la xifra, sense dir de qui. */
  nom: string;
  /** El slug de la seva fitxa, si la marca ha de ser un enllaç. */
  slug?: string;
  /** Cert per a «tu ets aquí»: la marca es pinta de coral i sobresurt. */
  aquest?: boolean;
};

export type OpcionsDispersio = {
  format: (valor: number) => string;
  /** Prefix del camí fins a l'arrel, per als enllaços: «../../» a les comarques. */
  base?: string;
  /** El recompte del peu del títol, escrit per qui crida: «23 de 30 municipis amb dada». */
  quants?: string;
  /** Com es diu la fila del mig: «La mediana d'aquí» per defecte. */
  etiquetaMediana?: string;
  /** El subtítol de la mediana: «el municipi del mig» per defecte. */
  sotaMediana?: string;
};

/**
 * Un regle del valor més baix al més alt del grup, amb una marca per municipi.
 *
 * Va néixer a la pàgina de comarca («I entre els seus municipis») i viu aquí
 * perquè la fitxa municipal el pugui dibuixar també: és l'única peça que
 * ensenya el grup sencer i no un resum, i una mediana amb la forma del grup al
 * costat diu el que la mediana sola no pot dir.
 *
 * El regle va del més baix al més alt del grup, no de zero: la pregunta és qui
 * és a dalt i qui a baix d'aquí, i estirar-lo fins al zero aplanaria totes les
 * diferències en un pam de barra. Les tres xifres —mínim, mediana, màxim— van
 * sempre escrites a sota, perquè el dibuix mai no sigui l'única manera de
 * llegir-les. Amb menys de quatre valors no hi ha dispersió, hi ha tres
 * xifres: val més dir-les, i es torna cadena buida.
 *
 * Una marca amb `slug` és un enllaç a la fitxa d'aquell municipi; sense slug és
 * una marca i prou, que és el cas de la fitxa municipal: `MedianaGrup.valors`
 * guarda les xifres del grup però no de quin municipi és cadascuna.
 */
export function regleDispersio(
  titol: string,
  valors: readonly ValorDispersio[],
  opcions: OpcionsDispersio,
): string {
  if (valors.length < 4) return "";
  const ordenats = [...valors].sort((a, b) => a.valor - b.valor);
  const baix = ordenats[0]!;
  const alt = ordenats[ordenats.length - 1]!;
  if (alt.valor === baix.valor) return "";
  // La mediana del que es dibuixa: amb un nombre parell, la mitjana dels dos del mig.
  const meitat = Math.floor(ordenats.length / 2);
  const mig =
    ordenats.length % 2 === 0
      ? (ordenats[meitat - 1]!.valor + ordenats[meitat]!.valor) / 2
      : ordenats[meitat]!.valor;
  // Del 4 % al 96 % i no de 0 a 100: la marca fa 14 px i als extrems mitja
  // marca quedava fora de la caixa arrodonida.
  const on = (v: number): string => (4 + (92 * (v - baix.valor)) / (alt.valor - baix.valor)).toFixed(2);
  const base = opcions.base ?? "../../";
  const fmt = opcions.format;

  const ambAquest = ordenats.some((v) => v.aquest);
  const marques = ordenats
    .map((v) => {
      const classe = v.aquest ? "marca aquest" : "marca";
      const veu = v.nom ? `<span class="nomes-lectors">${escape(v.nom)}, ${fmt(v.valor)}</span>` : "";
      return v.slug
        ? `<a class="${classe}" style="--p:${on(v.valor)}%" href="${base}m/${escape(v.slug)}/"
      >${veu}</a>`
        : `<i class="${classe}" style="--p:${on(v.valor)}%">${veu}</i>`;
    })
    .join("");

  const extrem = (v: ValorDispersio): string =>
    v.slug
      ? `<a href="${base}m/${escape(v.slug)}/">${escape(v.nom)}</a>`
      : v.nom
        ? `<span>${escape(v.nom)}</span>`
        : "";

  return `<figure class="dispersio">
  <figcaption class="titol">${escape(titol)}
    ${opcions.quants ? `<span class="secundari">${escape(opcions.quants)}</span>` : ""}</figcaption>
  <div class="regle-dispersio${ambAquest ? " amb-aquest" : ""}"><i class="mig" style="--p:${on(mig)}%"></i>${marques}</div>
  <ul class="extrems">
    <li><span class="cap">El més baix</span>
      ${extrem(baix)}<b>${fmt(baix.valor)}</b></li>
    <li><span class="cap">${escape(opcions.etiquetaMediana ?? "La mediana d'aquí")}</span>
      <span class="secundari">${escape(opcions.sotaMediana ?? "el municipi del mig")}</span><b>${fmt(mig)}</b></li>
    <li><span class="cap">El més alt</span>
      ${extrem(alt)}<b>${fmt(alt.valor)}</b></li>
  </ul>
</figure>`;
}

/**
 * CSS dels gràfics. Va a part del full de la fitxa perquè aquest fitxer es
 * pugui llegir sencer sense obrir-ne un altre.
 */
export const GRAFICS_CSS = `
/* --- els gràfics d'eix: sèries temporals i distribucions ------------------ */
.grafic{margin:var(--e2) 0 0;padding:0}
.grafic svg{display:block;width:100%;height:auto;overflow:visible}
.grafic .graella{stroke:var(--vora);stroke-width:1}
.grafic .eix{stroke:var(--ink);stroke-width:2}
.grafic .marca-any{stroke:var(--vora);stroke-width:1.5}
.grafic .etiqueta-eix{font-family:var(--text);font-size:12px;font-weight:700;
  fill:var(--ink-suau);font-variant-numeric:tabular-nums}
/* La banda del grup és fons, no dada puntual: va tenyida i sense contorn, i per
   això no fa falta que passi cap mínim de contrast de text. La mediana sí que
   és una dada i va amb una línia que es distingeix de la del municipi per la
   forma —discontínua— i no només pel color, que és el que la fa llegible amb
   qualsevol daltonisme. */
.grafic .banda{fill:var(--lavanda);opacity:.5}
@media (prefers-color-scheme:dark){ .grafic .banda{fill:#4b467a;opacity:.55} }
.grafic .mediana-grup{fill:none;stroke:var(--ink-suau);stroke-width:2;
  stroke-dasharray:6 5;stroke-linecap:round}
.grafic .linia{fill:none;stroke:var(--ink);stroke-width:3;stroke-linejoin:round;stroke-linecap:round}
.grafic .nus{fill:var(--paper);stroke:var(--ink);stroke-width:2}
.grafic .nus.ara{fill:var(--coral);stroke:var(--ink);stroke-width:2.5}
.grafic .tall-mandat{stroke:var(--ink);stroke-width:1.5;stroke-dasharray:3 4;opacity:.45}
.grafic .etiqueta-mandat{font-family:var(--display);font-size:11px;font-weight:900;
  fill:var(--ink-suau);letter-spacing:.02em}
/* L'any que la font no publica: un cercle buit i una columna puntejada, que no
   es pot confondre ni amb un valor a zero ni amb el guió d'un canvi de mandat. */
.grafic .buit{stroke:var(--ink-suau);stroke-width:1;stroke-dasharray:1 5;
  stroke-linecap:round;opacity:.5}
.grafic .forat{fill:none;stroke:var(--ink-suau);stroke-width:1.5;stroke-dasharray:2 3}
.clau-grafic{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;
  margin:var(--e1) 0 0;font-size:.8rem;font-weight:700;color:var(--ink-suau)}
.clau-grafic .mostra{display:inline-block;width:22px;height:0;border-radius:2px;vertical-align:middle}
.clau-grafic .mostra-linia{border-top:3px solid var(--ink)}
.clau-grafic .mostra-banda{height:12px;background:var(--lavanda);opacity:.6}
@media (prefers-color-scheme:dark){ .clau-grafic .mostra-banda{background:#4b467a} }
.clau-grafic .mostra-mediana{border-top:2px dashed var(--ink-suau)}
.clau-grafic .mostra-forat{width:11px;height:11px;border:1.5px dashed var(--ink-suau);
  border-radius:50%}
/* --- les tres mides de la sèrie ------------------------------------------ */
/* La mitjana i l'espurna no són la gran feta petita: hi ha menys tinta per
   unitat i, com que el dibuix s'ensenya sencer, la tinta que queda ha de ser
   més gruixuda per veure-s'hi igual. */
.serie-mitjana .linia{stroke-width:2.6}
.serie-espurna{margin:6px 0 0}
.serie-espurna .linia{stroke-width:2.4}
.serie-espurna svg{max-width:160px}
/* --- el salt entre dos anys ---------------------------------------------- */
/* El carril és el que fa comparables dues files: ensenya tot el tram de
   l'escala, i així un salt curt a dalt de tot i un salt curt a baix no es
   llegeixen igual. */
.pendent{margin:var(--e1) 0 0}
.pendent svg{max-width:320px}
.pendent .carril{stroke:var(--vora);stroke-width:1;stroke-linecap:round}
.pendent .salt{stroke:var(--ink);stroke-width:4;stroke-linecap:round}
.pendent .salt-grup{stroke:var(--ink-suau);stroke-width:1.5;stroke-dasharray:4 4;stroke-linecap:round}
.pendent .cap-inici{fill:var(--paper);stroke:var(--ink);stroke-width:2}
.pendent .cap-final{fill:var(--coral);stroke:var(--ink);stroke-width:2}
.pendent .cap-inici.grup{stroke:var(--ink-suau);stroke-width:1.5}
.pendent .cap-final.grup{fill:var(--ink-suau);stroke:none}
.pendent .xifra{font-family:var(--display);font-size:12px;font-weight:900;
  fill:var(--ink);font-variant-numeric:tabular-nums}
.pendent .xifra.abans{font-weight:700;fill:var(--ink-suau)}
/* --- la distribució del grup --------------------------------------------- */
/* Les caselles van del color de la casa i la del municipi va de coral, que és
   el color que la fitxa fa servir sempre per a «tu ets aquí». Perquè no depengui
   només del color, la seva porta a més el contorn de tinta i la fletxa a sota. */
.distribucio .casella{fill:var(--lavanda)}
@media (prefers-color-scheme:dark){ .distribucio .casella{fill:#4b467a} }
.distribucio .casella.meva{fill:var(--coral);stroke:var(--ink);stroke-width:1.5}
.distribucio .fletxa-aqui{fill:var(--ink)}
.distribucio .etiqueta-aqui{font-family:var(--display);font-size:13px;font-weight:900;
  fill:var(--ink);font-variant-numeric:tabular-nums}
.distribucio .clau-grafic{display:block}

/* --- les barres divergents ----------------------------------------------- */
/* El canal sencer és l'escala i el zero és al mig: el que puja surt cap a la
   dreta i el que baixa cap a l'esquerra, amb una sola tinta. La ratlla grisa
   és el mateix canvi al grup, i la xifra va sempre escrita al costat perquè
   una barra sola no és una dada llegible. */
.divergents{margin:var(--e2) 0 0}
/* Una sola graella per a tota la llista, no una per fila. Amb la graella al
   <li>, la columna de l'etiqueta s'amidava fila a fila —«Habitatge» curt,
   «Administració general» llarg— i cada canal sortia d'una llargada diferent:
   el zero, que ha de ser una vertical de dalt a baix, feia esses. Amb els <li>
   com a «display:contents» totes les files comparteixen les tres columnes,
   tots els canals fan exactament igual i el zero és una sola línia recta. */
.barres-divergents{list-style:none;margin:0;padding:0;display:grid;
  grid-template-columns:minmax(9em,14em) minmax(0,1fr) auto;gap:9px var(--e2);align-items:center}
.barres-divergents li{display:contents}
.barres-divergents .etq{grid-column:1;font-weight:800;font-size:.9rem;line-height:1.2;overflow-wrap:anywhere}
.barres-divergents .etq a{color:inherit;text-decoration:none;border-bottom:1.5px solid var(--vora)}
.barres-divergents .canal{grid-column:2;position:relative;height:16px;background:var(--vora);border-radius:var(--r-max)}
.barres-divergents .canal::before{content:"";position:absolute;left:50%;top:-4px;bottom:-4px;width:2px;
  margin-left:-1px;background:var(--ink);border-radius:2px;z-index:1}
/* El mateix radi petit als dos extrems de la barra: el radi de píldora amb el
   costat del zero escapçat feia semblar cada barra mig rosegada. L'alçada i el
   «display» van escrits encara que el «top/bottom» ja ho digui: el full de la
   fitxa té un altre «.barra» —el de les columnes d'eleccions, 46px i flex— i
   sense això la barra sortia inflada per sota del canal. */
.barres-divergents .barra{position:absolute;top:0;bottom:0;height:auto;display:block;width:var(--w);
  background:var(--lavanda);border:1.5px solid var(--ink);border-radius:4px}
.barres-divergents .positiu .barra{left:50%}
.barres-divergents .negatiu .barra{right:50%}
/* Un canvi de zero no dibuixa cap barra: un tros mínim al costat del zero es
   llegiria com un canvi petit, i no n'hi ha hagut cap. */
.barres-divergents .zero .barra{display:none}
/* La marca del grup viu DINS del canal, centrada en vertical: sobresortint per
   dalt i per baix es confonia amb el zero i muntava sobre la fila del costat. */
.barres-divergents .marca-grup{position:absolute;top:2px;bottom:2px;left:var(--m);width:3px;
  margin-left:-1.5px;background:var(--ink-suau);border-radius:2px}
/* La xifra i el «seus» comparteixen cel·la: així cada fila és una sola fila de
   graella i la xifra queda alineada a la dreta amb totes les altres. */
.barres-divergents .xifres{grid-column:3;display:flex;flex-direction:column;align-items:flex-end;gap:1px}
.barres-divergents .xifra{font-family:var(--display);font-weight:900;font-size:1.05rem;text-align:right;
  font-variant-numeric:tabular-nums;white-space:nowrap;letter-spacing:-.01em}
.barres-divergents .del-grup{font-size:.72rem;color:var(--ink-suau);font-weight:700;
  text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.divergents .mostra-zero{width:2px;height:14px;background:var(--ink)}
.divergents .mostra-barra{height:12px;background:var(--lavanda);border:1.5px solid var(--ink)}
.divergents .mostra-tick{width:3px;height:14px;background:var(--ink-suau)}
/* La taula per a qui llegeix amb veu porta els mateixos enllaços que el dibuix
   i és l'única còpia que el teclat pot arribar a tocar: quan hi arriba, es fa
   visible, perquè un enllaç amb el focus no pot ser un punt invisible. */
.divergents .nomes-lectors:focus-within{position:static;width:auto;height:auto;overflow:visible;
  clip:auto;clip-path:none;white-space:normal;margin:var(--e2) 0 0}
.divergents .nomes-lectors:focus-within table{width:100%;border-collapse:collapse;font-size:.9rem}
.divergents .nomes-lectors:focus-within th,.divergents .nomes-lectors:focus-within td{text-align:left;
  padding:6px 10px 6px 0;border-bottom:1px solid var(--vora)}
/* En estret cada fila torna a ser la seva graella: l'etiqueta i la xifra a
   dalt i el canal a sota, d'una vora a l'altra. Aquí el canal ocupa tota
   l'amplada a totes les files, així que la igualtat de llargades i el zero
   recte no depenen de compartir columnes. Amb la graella compartida, la
   col·locació automàtica enviava la xifra a una fila per sota del canal. */
/* A 560–700 px les tres columnes encara no hi caben: la xifra en negreta
   acaba damunt del canal (especialment amb €/hab). Passem al dibuix apilat
   abans que el text i la barra es puguin tocar. */
@media (max-width:760px){
  .barres-divergents{display:block}
  .barres-divergents li{display:grid;grid-template-columns:minmax(0,1fr) auto;
    gap:3px var(--e2);align-items:center;margin:0 0 12px}
  .barres-divergents li:last-child{margin-bottom:0}
  .barres-divergents .xifres{grid-column:2;grid-row:1}
  .barres-divergents .canal{grid-column:1/-1;grid-row:2}
}

/* --- el regle de dispersió ------------------------------------------------ */
/* Cada marca és un municipi col·locat entre el més baix i el més alt del grup.
   La marca fa 14 px d'ample encara que la ratlla en faci 4: per sota d'això no
   és un enllaç que es pugui tocar amb el dit. El contenidor es diu
   «regle-dispersio» i no «regle» perquè la fitxa ja té un .regle —el de
   percentatges— amb marges i alçades seus que aquí farien nosa. */
.dispersio{margin:0 0 var(--e3)}
.dispersio .titol{font-weight:800;font-size:.95rem;margin:0 0 10px;display:flex;
  flex-wrap:wrap;gap:0 8px;align-items:baseline}
.dispersio .regle-dispersio{position:relative;height:46px;border:2.5px solid var(--ink);border-radius:var(--r-s);
  background:linear-gradient(90deg,var(--paper-2),var(--lavanda))}
.dispersio .marca{position:absolute;left:var(--p);top:0;bottom:0;width:14px;margin-left:-7px}
.dispersio .marca::before{content:"";position:absolute;left:5px;top:5px;bottom:5px;width:4px;
  border-radius:2px;background:var(--ink);opacity:.5}
.dispersio a.marca:hover::before,.dispersio a.marca:focus-visible::before{background:var(--coral-text);
  opacity:1;left:4px;width:6px;top:2px;bottom:2px}
/* La mediana surt de la caixa per dalt i per baix: ha de guanyar visualment a
   les 900 marques d'una comarca gran sense pintar-se d'un altre color. */
.dispersio .mig{position:absolute;left:var(--p);top:-7px;bottom:-7px;width:8px;margin-left:-4px;
  background:var(--coral);border:2px solid var(--ink);border-radius:4px}
/* «Tu ets aquí»: quan el regle porta la marca del municipi de la fitxa, el
   coral és per a ell —és el color que la casa hi reserva— i la mediana passa
   a paper, perquè no hi hagi dues marques de coral dient coses diferents. */
.dispersio .amb-aquest .mig{background:var(--paper-2)}
.dispersio .marca.aquest{z-index:1}
.dispersio .marca.aquest::before{background:var(--coral);opacity:1;left:3px;width:8px;top:-5px;bottom:-5px;
  border:2px solid var(--ink);border-radius:4px}
.dispersio .extrems{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:var(--e1);
  grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.dispersio .extrems li{display:flex;flex-direction:column;gap:1px}
.dispersio .cap{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;
  color:var(--ink-suau)}
.dispersio .extrems b{font-family:var(--display);font-weight:900;font-size:1.1rem;
  letter-spacing:-.02em;font-variant-numeric:tabular-nums}

/* --- una amplada, un dibuix ---------------------------------------------- */
/* De les sèries en surten dos dibuixos i se n'ensenya un. Un SVG no pot canviar
   de «viewBox» amb una consulta de mitjans, i el que canvia sota 480 px no és
   només què s'amaga: el marge esquerre passa de 62 a 40 i el dibuix guanya
   amplada de veritat. */
.grafic .estret{display:none}
@media (max-width:480px){
  .grafic .ample{display:none}
  .grafic .estret{display:block}
}
/* A 320px un eix de 720 unitats amb text de 12 hi cabria a 5px reals. Abans que
   això passi, el gràfic llisca **dins de la seva caixa**: la figura no pot fer
   més ample que la columna, o qui llisca és la pàgina sencera i la fitxa se'n
   va de costat sense que es vegi res que l'empenyi. */
@media (max-width:520px){
  .grafic{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;
    -webkit-overflow-scrolling:touch}
  .grafic .dibuix{min-width:420px}
  .serie-espurna .dibuix,.pendent .dibuix{min-width:0}
}
`;
