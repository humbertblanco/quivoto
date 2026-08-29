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
 *      és que no sabem què estem dibuixant.
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

export type OpcionsSerie = {
  /** Com s'escriu un valor: «1.204 €», «38,5 %»… */
  format: (valor: number) => string;
  /** Què es dibuixa, per a l'etiqueta de l'eix i per al text alternatiu. */
  titol: string;
  /** La banda del grup de mida, si se'n té. */
  banda?: readonly BandaGrup[];
  /** Com es diu el grup: «de 20.001 a 50.000 habitants». */
  grup?: string | null;
  /** Els mandats que travessa la sèrie, marcats amb una línia i una etiqueta. */
  mandats?: readonly TramMandat[];
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

  const banda = (opcions.banda ?? []).filter((b) => b.any >= serie[0]!.any && b.any <= serie[serie.length - 1]!.any);
  const desDeZero = opcions.desDeZero ?? true;

  const valors = [
    ...serie.map((p) => p.valor),
    ...banda.flatMap((b) => [b.p25, b.p50, b.p75]),
  ];
  const brutMax = Math.max(...valors);
  const brutMin = Math.min(...valors);
  const zeroSignificatiu = desDeZero && brutMin >= 0;
  const min = zeroSignificatiu ? 0 : brutMin - (brutMax - brutMin) * 0.08;
  const max = brutMax + (brutMax - min) * 0.08 || 1;

  const anyMin = serie[0]!.any;
  const anyMax = serie[serie.length - 1]!.any;
  const x = (any: number): number =>
    anyMax === anyMin
      ? MARGE.esquerra
      : MARGE.esquerra + ((any - anyMin) / (anyMax - anyMin)) * (AMPLE - MARGE.esquerra - MARGE.dreta);
  const y = (valor: number): number =>
    max === min
      ? (ALT - MARGE.baix + MARGE.dalt) / 2
      : ALT - MARGE.baix - ((valor - min) / (max - min)) * (ALT - MARGE.dalt - MARGE.baix);

  // --- la banda del grup, i la seva mediana
  let bandaSvg = "";
  if (banda.length >= 2) {
    const dalt = banda.map((b) => `${n2(x(b.any))} ${n2(y(b.p75))}`);
    const baix = [...banda].reverse().map((b) => `${n2(x(b.any))} ${n2(y(b.p25))}`);
    const mediana = banda.map((b, i) => `${i === 0 ? "M" : "L"}${n2(x(b.any))} ${n2(y(b.p50))}`).join(" ");
    bandaSvg = `<path class="banda" d="M${dalt.join(" L")} L${baix.join(" L")} Z"/>
      <path class="mediana-grup" d="${mediana}"/>`;
  }

  // --- els eixos
  const marques = marquesEix(min, max, 4);
  const graella = marques
    .map(
      (v) => `<line class="graella" x1="${MARGE.esquerra}" x2="${AMPLE - MARGE.dreta}" y1="${n2(y(v))}" y2="${n2(y(v))}"/>
      <text class="etiqueta-eix" x="${MARGE.esquerra - 8}" y="${n2(y(v) + 4)}" text-anchor="end">${escape(opcions.format(v))}</text>`,
    )
    .join("");

  const anys = serie.map((p) => p.any);
  const escrits = new Set(anysVisibles(anys));
  const eixX = anys
    .map((any) => {
      const marca = `<line class="marca-any" x1="${n2(x(any))}" x2="${n2(x(any))}" y1="${ALT - MARGE.baix}" y2="${ALT - MARGE.baix + 5}"/>`;
      if (!escrits.has(any)) return marca;
      return `${marca}<text class="etiqueta-eix" x="${n2(x(any))}" y="${ALT - MARGE.baix + 19}" text-anchor="middle">${any}</text>`;
    })
    .join("");

  // --- els mandats: una ratlla vertical on comença cadascun, amb qui hi havia
  const dins = (opcions.mandats ?? []).filter((m) => m.desDe > anyMin && m.desDe <= anyMax);
  const mandats = dins
    .map((m, i) => {
      const linia = `<line class="tall-mandat" x1="${n2(x(m.desDe))}" x2="${n2(x(m.desDe))}"
        y1="${MARGE.dalt}" y2="${ALT - MARGE.baix}"/>`;
      // Quan qui governa repeteix, el nom repetit no diu res de nou i només fa
      // soroll damunt de la línia. La ratlla sí que hi va: marca on comença un
      // mandat, i que el mateix nom governi els dos es veu perquè no n'hi ha
      // cap altre entremig.
      const anterior = i === 0 ? null : dins[i - 1]!.etiqueta;
      if (m.etiqueta === anterior || m.etiqueta === "") return linia;
      return `${linia}<text class="etiqueta-mandat" x="${n2(x(m.desDe) + 5)}" y="${MARGE.dalt + 11}">${escape(m.etiqueta)}</text>`;
    })
    .join("");

  // --- la línia del municipi
  const linia = serie.map((p, i) => `${i === 0 ? "M" : "L"}${n2(x(p.any))} ${n2(y(p.valor))}`).join(" ");
  const nusos = serie
    .map((p) => `<circle class="nus" cx="${n2(x(p.any))}" cy="${n2(y(p.valor))}" r="3.4"/>`)
    .join("");
  const ultim = serie[serie.length - 1]!;
  const primer = serie[0]!;

  // --- l'equivalent en text, que no és una nota al peu sinó la mateixa dada
  const capBanda = banda.length >= 2;
  const taula = `<table class="nomes-lectors">
    <caption>${escape(opcions.titol)}${opcions.grup ? `, amb la meitat central dels municipis ${escape(opcions.grup)}` : ""}</caption>
    <thead><tr><th scope="col">Any</th><th scope="col">${escape(opcions.titol)}</th>
    ${capBanda ? "<th scope=\"col\">Mediana del grup</th>" : ""}</tr></thead>
    <tbody>${serie
      .map((p) => {
        const b = banda.find((x2) => x2.any === p.any);
        return `<tr><th scope="row">${p.any}</th><td>${escape(opcions.format(p.valor))}</td>
        ${capBanda ? `<td>${b ? escape(opcions.format(b.p50)) : "sense dada"}</td>` : ""}</tr>`;
      })
      .join("")}</tbody></table>`;

  const resum = `${escape(opcions.titol)}: de ${escape(opcions.format(primer.valor))} el ${primer.any} a ${escape(
    opcions.format(ultim.valor),
  )} el ${ultim.any}.`;

  return `<figure class="grafic">
    <svg viewBox="0 0 ${AMPLE} ${ALT}" role="img" aria-label="${resum}" preserveAspectRatio="xMidYMid meet">
      ${graella}
      ${bandaSvg}
      ${mandats}
      <line class="eix" x1="${MARGE.esquerra}" x2="${AMPLE - MARGE.dreta}" y1="${ALT - MARGE.baix}" y2="${ALT - MARGE.baix}"/>
      ${eixX}
      <path class="linia" d="${linia}"/>
      ${nusos}
      <circle class="nus ara" cx="${n2(x(ultim.any))}" cy="${n2(y(ultim.valor))}" r="5.4"/>
    </svg>
    ${
      capBanda
        ? `<figcaption class="clau-grafic">
      <span class="mostra mostra-linia"></span> aquest municipi
      <span class="mostra mostra-banda"></span> la meitat central dels municipis ${escape(opcions.grup ?? "de la seva mida")}
      <span class="mostra mostra-mediana"></span> la seva mediana
    </figcaption>`
        : ""
    }
    ${zeroSignificatiu ? "" : `<p class="compta">L'eix no comença a zero: aquesta xifra pot ser negativa i el zero no en marca cap límit.</p>`}
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
      <path class="fletxa-aqui" d="M${n2(Math.max(4, Math.min(AMPLE_D - 4, x(valor))))} ${ALT_D - BAIX + 2}
        l-5 8 h10 Z"/>
    </svg>
    <figcaption class="clau-grafic">${perSota} dels ${ordenats.length} municipis ${escape(opcions.grup)}
    en tenen menys${opcions.unitat ? ` ${escape(opcions.unitat)}` : ""}; la mediana del grup és
    ${escape(opcions.format(mediana))}.</figcaption>
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
.clau-grafic{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;
  margin:var(--e1) 0 0;font-size:.8rem;font-weight:700;color:var(--ink-suau)}
.clau-grafic .mostra{display:inline-block;width:22px;height:0;border-radius:2px;vertical-align:middle}
.clau-grafic .mostra-linia{border-top:3px solid var(--ink)}
.clau-grafic .mostra-banda{height:12px;background:var(--lavanda);opacity:.6}
@media (prefers-color-scheme:dark){ .clau-grafic .mostra-banda{background:#4b467a} }
.clau-grafic .mostra-mediana{border-top:2px dashed var(--ink-suau)}
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

/* A 320px un eix de 720 unitats amb text de 12 hi cabria a 5px reals. El gràfic
   es desplaça dins del seu contenidor abans que això passi. */
@media (max-width:520px){
  .grafic{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .grafic svg{min-width:460px}
}
`;
