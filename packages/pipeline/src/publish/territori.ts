import { dataCurta } from "../lib/text";
import { sigla } from "./sigla";

/**
 * El que comparteixen les 43 comarques i l'AMB: els blocs del poder.
 *
 * Les dues pàgines són la mateixa forma amb un altre perímetre —un grapat de
 * municipis, qui hi mana, on hi va haver pacte i on ha canviat l'alcaldia— i
 * fins ara cadascuna en portava una còpia literal. Eren tres funcions
 * bessones i dues seccions senceres repetides, amb frases que havien divergit
 * sense voler: a la comarca els pactes duien la pastilla del partit i a l'AMB
 * no; a la comarca el «des de l'1 de juliol» s'apostrofava i a l'AMB també,
 * però perquè algú ho havia copiat a temps. Qualsevol arranjament s'havia de
 * fer dues vegades o quedava a mitges en una de les dues.
 *
 * Aquí hi ha una sola còpia i una taula de paraules per al que és diferent de
 * debò: com s'anomenen els municipis («d'aquesta comarca», «metropolitans»),
 * si es diu «de 23» o «dels 36», i la nota que només val a l'AMB —que un canvi
 * d'alcaldia també canvia qui seu al Consell Metropolità. Els camins cap a la
 * fitxa de cada poble van amb `base`, perquè la comarca viu dos nivells avall
 * i l'AMB un.
 */

// ------------------------------------------------------------------- formes

export type AmbitTerritori = "comarca" | "amb";

/** El mínim d'un municipi que necessiten els blocs. `ComarcaMunicipi` i `AmbMunicipi` el compleixen. */
export type MunicipiPoder = {
  slug: string;
  name: string;
  mayorSigles: string | null;
  /** Marca de l'alcaldia, resolta per les sigles de la seva candidatura del 2023. */
  mayorBrandId: string | null;
  winnerSigles: string | null;
  /** `null` quan no hem pogut lligar l'alcaldia amb cap llista. */
  winnerGoverns: boolean | null;
  mayorChanged: boolean;
  mayorChangeName: string | null;
  mayorChangeDate: string | null;
};

/** Els comptes d'un territori que fan falta per pintar els blocs. */
export type DadesPoder = {
  municipis: readonly MunicipiPoder[];
  governaMesVotat: number;
  pacte: number;
  senseIdentificar: number;
  /** Municipis on la llista més votada governa i, a més, té la majoria absoluta. */
  majoriaAbsoluta: number;
};

export type OpcionsTerritori = {
  /** Camí fins a `/observatori/`, amb la barra final: «../../» a la comarca, «../» a l'AMB. */
  base: string;
  ambit: AmbitTerritori;
};

// ------------------------------------------------------------------ paraules

/**
 * Les frases que canvien d'un àmbit a l'altre, i només aquestes.
 *
 * «De 23» i «dels 36» no són un caprici: la comarca és un recompte que pot
 * variar —«a 2 de 23»— i l'àrea és una llista tancada que la llei anomena un
 * a un, i en català l'article marca justament això.
 */
type Paraules = {
  /** «municipi d'aquesta comarca», «municipi metropolità». */
  municipi: string;
  municipis: string;
  /** «de 23» a la comarca, «dels 36» a l'AMB. */
  deN: (n: number) => string;
  /** El que la nota dels canvis ha d'afegir en aquest àmbit, o res. */
  notaCanvis: string;
};

const PARAULES: Record<AmbitTerritori, Paraules> = {
  comarca: {
    municipi: "municipi d'aquesta comarca",
    municipis: "municipis d'aquesta comarca",
    deN: (n) => `de ${n}`,
    notaCanvis: "",
  },
  amb: {
    municipi: "municipi metropolità",
    municipis: "municipis metropolitans",
    deN: (n) => `dels ${n}`,
    notaCanvis: " Un canvi d'alcaldia també canvia qui seu al Consell Metropolità.",
  },
};

// -------------------------------------------------------------- presentació

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * «des de l'1 de juliol», no «des del 1 de juliol»: l'u i l'onze són els dos
 * únics dies que comencen amb vocal, i l'article s'hi apostrofa.
 */
function sinceDate(iso: string | null): string {
  if (!iso) return "";
  const day = Number(iso.slice(8, 10));
  return `${day === 1 || day === 11 ? "des de l'" : "des del "}${dataCurta(iso)}`;
}

// --------------------------------------------------------------- fragments

/** Governa el més votat, o hi va haver pacte. Una barra de tres trams i prou. */
export function renderRepartiment(data: DadesPoder): string {
  const total = Math.max(1, data.municipis.length);
  const trams: ReadonlyArray<readonly [number, string, string]> = [
    [data.governaMesVotat, "governa-guanyador", "governa el més votat"],
    [data.pacte, "governa-pacte", "hi va haver pacte"],
    [data.senseIdentificar, "governa-desconegut", "sense identificar"],
  ];
  const bars = trams
    .filter(([n]) => n > 0)
    .map(([n, cls, label]) => {
      const share = (100 * n) / total;
      return `<span class="${cls}" style="--w:${share}%" title="${n} ${escape(label)}">${share >= 7 ? `<b>${n}</b>` : ""}</span>`;
    })
    .join("");
  const clau = trams
    .filter(([n]) => n > 0)
    .map(([n, cls, label]) => `<li><span class="mostra ${cls}"></span><b>${n}</b> ${escape(label)}</li>`)
    .join("");
  return `<figure class="grafic">
  <div class="repartiment" role="img" aria-label="${trams.filter(([n]) => n > 0).map(([n, , label]) => `${n} ${label}`).join("; ")}.">${bars}</div>
  <ul class="clau">${clau}</ul>
</figure>`;
}

/** Els municipis on l'alcaldia no és de la llista més votada, amb nom i cognoms. */
export function renderPactes(data: DadesPoder, opcions: OpcionsTerritori): string {
  const p = PARAULES[opcions.ambit];
  const pactes = data.municipis.filter((m) => m.winnerGoverns === false);
  if (pactes.length === 0) {
    return `<p>A tots els ${p.municipis} on hem pogut identificar l'alcaldia, la governa la
    llista més votada.</p>`;
  }
  const items = pactes
    .map((m) => {
      // Les sigles de la guanyadora no porten marca desada —la mètrica només
      // en desa el nom— i `sigla()` l'endevina per la família de les sigles.
      // Quan no l'endevina, la pastilla es queda pintada i sense enllaç.
      const mana = m.mayorSigles ? sigla(m.mayorSigles, { base: opcions.base, brandId: m.mayorBrandId }) : "?";
      const guanya = m.winnerSigles ? sigla(m.winnerSigles, { base: opcions.base }) : "?";
      return `<li><a href="${escape(opcions.base)}m/${escape(m.slug)}/">${escape(m.name)}</a>
      <span class="secundari">governa ${mana}; la més votada, ${guanya}</span></li>`;
    })
    .join("");
  return `<p>A <b>${pactes.length}</b> ${p.deN(data.municipis.length)}
  ${plural(pactes.length, "municipi", "municipis")} l'alcaldia no és de la llista més votada: hi va haver pacte.</p>
  <ul class="detall">${items}</ul>`;
}

/** Canvis d'alcaldia a mig mandat, que és on es veu la política que no es vota. */
export function renderCanvis(data: DadesPoder, opcions: OpcionsTerritori): string {
  const p = PARAULES[opcions.ambit];
  const canvis = data.municipis.filter((m) => m.mayorChanged);
  if (canvis.length === 0) {
    return `<p>Cap ${p.municipi} no ha canviat d'alcaldia des de la constitució dels plens el
    juny del 2023.</p>`;
  }
  const items = canvis
    .map(
      (m) => `<li><a href="${escape(opcions.base)}m/${escape(m.slug)}/">${escape(m.name)}</a>
      <span class="secundari">${escape(m.mayorChangeName ?? "")}${m.mayorChangeDate ? `, ${sinceDate(m.mayorChangeDate)}` : ""}</span></li>`,
    )
    .join("");
  return `<p><b>${canvis.length}</b> ${plural(canvis.length, "municipi ha canviat", "municipis han canviat")}
  d'alcaldia des de la constitució dels plens del juny del 2023.</p>
  <ul class="detall">${items}</ul>
  <p class="nota">Les fonts desen qui ocupa el càrrec, no per què va marxar l'anterior: aquí no
  s'hi pot llegir ni una dimissió ni una moció de censura.${p.notaCanvis}</p>`;
}

/**
 * Les dues seccions senceres: on va governar la llista més votada i qui ha
 * canviat d'alcaldia a mig mandat. Les àncores `#pactes` i `#canvis` són les
 * que fan servir la ullada de la portada i l'índex de les dues pàgines.
 */
export function renderBlocsPoder(data: DadesPoder, opcions: OpcionsTerritori): string {
  const p = PARAULES[opcions.ambit];
  const total = data.municipis.length;
  return `<section class="bloc" id="pactes">
  <h2>On va governar la llista més votada</h2>
  ${renderRepartiment(data)}
  <p>A <b>${data.majoriaAbsoluta}</b> ${p.deN(total)}
  ${plural(data.majoriaAbsoluta, "municipi la llista guanyadora governa", "municipis la llista guanyadora governa")}
  amb majoria absoluta, i per tant no va necessitar ningú.</p>
  ${renderPactes(data, opcions)}
  <p class="nota">«Pacte» vol dir només que l'alcaldia no és de la llista més votada. Què s'hi
  va acordar no ho sabem: les investidures no són dades obertes.</p>
</section>

<section class="bloc" id="canvis">
  <h2>Qui ha canviat d'alcaldia a mig mandat</h2>
  ${renderCanvis(data, opcions)}
</section>`;
}

// ------------------------------------------------------------------ estil

/**
 * El que les pàgines de territori necessiten i la fitxa municipal no té.
 *
 * És el full de les 43 comarques i de l'AMB, i d'una sola còpia: cadascuna hi
 * afegeix el que és seu —el mapa de taques i la dispersió a la comarca, les
 * competències i el segell de situació a l'AMB. Va aquí i no a `estil.ts`
 * perquè és el full de dues pàgines, no un patró del portal.
 */
export const TERRITORI_CSS = `
/* El poder en dues cintes: alcaldies a dalt, població governada a baix, amb els
   mateixos colors i en el mateix ordre. Comparar-les només funciona si les dues
   comencen a la mateixa vertical, i per això l'etiqueta té columna pròpia. */
.poder{margin:0 0 var(--e3)}
.tira-fila{display:grid;grid-template-columns:minmax(0,9.5em) 1fr;gap:6px var(--e2);
  align-items:center;margin-bottom:var(--e2)}
.etq-tira{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;
  color:var(--ink-suau);line-height:1.2}
.tira{display:flex;height:34px;border:2.5px solid var(--ink);border-radius:var(--r-s);overflow:hidden}
/* Un tram d'una alcaldia sobre trenta fa l'1,7 % i sense mínim desapareixeria:
   qui mana en un sol poble ha de continuar sent visible a la cinta. */
.tira i{display:block;height:100%;width:var(--w);min-width:3px;background:var(--c);
  border-right:1.5px solid var(--ink)}
.tira i:last-child{border-right:0}
@media (max-width:560px){ .tira-fila{grid-template-columns:1fr} }
.poder-clau{list-style:none;margin:0;padding:0;display:grid;gap:var(--e1);
  grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.poder-clau li{padding:8px 0;border-bottom:1px solid var(--vora);display:flex;flex-direction:column;gap:1px}
.poder-clau .nom{font-weight:800;font-size:.94rem;display:flex;align-items:center;gap:8px}
.poder-clau .dada{font-size:.84rem;color:var(--ink-suau)}
.poder-clau .dada b{font-family:var(--display);font-weight:900;font-size:1.05rem;
  letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums}

/* El mapa del territori. Cada punt és un enllaç, i per això té estat de focus:
   sense això, qui hi va amb el teclat no sap mai on és. */
.mapa-territori{margin:0 0 var(--e3)}
.mapa-territori svg{display:block;width:100%;height:auto;max-height:70vh}
.mapa-territori circle{transition:r .12s ease}
.mapa-territori a:hover circle{stroke-width:3.5}
.mapa-territori a:focus-visible circle{outline:3px solid var(--coral-text);outline-offset:3px}
.mapa-territori figcaption{font-size:.8rem;color:var(--ink-suau);line-height:1.4;margin-top:var(--e1)}
.mapa-territori figcaption a{font-weight:800}
@media (prefers-reduced-motion:reduce){.mapa-territori circle{transition:none}}

/* Governa el més votat o hi va haver pacte: una barra i prou. Els colors són
   els de la identitat, no els de cap partit: aquí no es parla de forces. */
.repartiment{display:flex;height:52px;border:2.5px solid var(--ink);border-radius:var(--r-s);overflow:hidden}
.repartiment span{width:var(--w);display:flex;align-items:center;justify-content:center;
  border-right:1.5px solid var(--ink);color:#1E1B2E;font-family:var(--display);font-weight:900;font-size:1.1rem}
.repartiment span:last-child{border-right:0}
.governa-guanyador{background:var(--menta)}
.governa-pacte{background:var(--presec)}
.governa-desconegut{background:var(--lavanda)}
.clau .mostra.governa-guanyador{background:var(--menta)}
.clau .mostra.governa-pacte{background:var(--presec)}
.clau .mostra.governa-desconegut{background:var(--lavanda)}

/* Llistes de municipis amb un detall al costat: pactes i canvis d'alcaldia.
   220 px i no 240: a 320 px de pantalla el contingut en fa 272, i una columna
   més ampla que això vessaria. */
.detall{list-style:none;margin:0 0 var(--e2);padding:0;display:grid;gap:var(--e1);
  grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.detall li{padding:8px 0;border-bottom:1px solid var(--vora);display:flex;flex-direction:column;gap:1px}
.detall a{font-weight:800}
.detall .nom{font-weight:800}
/* Les pastilles de partit dins d'una frase: alineades amb el text i no amb el
   peu de la línia, que és on les deixa un «inline-block» sense ajustar. */
.detall .secundari .sigla{vertical-align:middle}

/* Les targetes d'indicador reaprofiten .indicadors i .indicador de la fitxa. */
.indicador .referencia,.indicador .percentil{font-size:.88rem}
.indicador .percentil{background:var(--lavanda);color:#1E1B2E;border-radius:var(--r-s);
  padding:5px 9px;align-self:flex-start;font-weight:700}

/* La llista de municipis: la taula més llarga del portal, 68 files a l'Alt Empordà. */
.municipis{width:100%;border-collapse:collapse;font-size:.92rem}
.municipis th,.municipis td{text-align:left;padding:9px 10px 9px 0;border-bottom:1px solid var(--vora);vertical-align:top}
.municipis thead th{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-suau);border-bottom:2.5px solid var(--ink)}
.municipis tbody th{font-weight:800}
.municipis .xifra{font-variant-numeric:tabular-nums;white-space:nowrap}
.marca-pacte,.marca-minoria{display:inline-block;border-radius:var(--r-max);padding:2px 9px;
  font-size:.68rem;font-weight:800;white-space:nowrap;color:#1E1B2E}
.marca-pacte{background:var(--presec)}
.marca-minoria{background:var(--lavanda)}
@media (max-width:640px){
  .municipis thead{display:none}
  .municipis tr{display:block;padding:10px 0;border-bottom:1px solid var(--vora)}
  .municipis th,.municipis td{display:block;border:0;padding:1px 0}
  .municipis tbody th{font-size:1.02rem}
  /* Sense capçalera de taula, «685» i «7» tots sols no volen dir res: la unitat
     s'escriu al costat i les dades tornen a la mateixa línia. */
  .municipis .com,.municipis .pob,.municipis .reg{display:inline;font-weight:400;color:var(--ink-suau);font-size:.86rem}
  .municipis .com::after{content:" · "}
  .municipis .pob::after{content:" habitants · "}
  .municipis .reg::after{content:" regidories"}
}
`;
