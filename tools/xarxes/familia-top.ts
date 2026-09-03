/**
 * «Top 5 / Top 10»: una llista amb barres i la mediana marcada. Les xifres
 * són les del JSON de la pàgina de rànquings (`#dades-ranquings`), amb el
 * títol i la font que hi publica cada secció.
 *
 * La mediana és la de tots els municipis amb dada (o la del grup de mida, quan
 * el rànquing es fa dins d'un grup): sense ella, un top 10 només diu qui és
 * primer, no com de lluny és del municipi del mig.
 */

import { escape, logo, n, peu, type Fons, type Mida } from "./estil";
import { mediana } from "./dades";
import { OBS, type Dades, type Proposta } from "./propostes";

type Top = {
  nom: string; metrica: string; titolPropi: string; quants: number;
  /** Grup de mida (`t8-9`…) o `null` per a tot Catalunya. */
  grup: string | null;
  /** Ordena de més a menys (per defecte) o de menys a més. */
  menys?: boolean;
  tuit: (files: Fila[], med: number) => string;
};
type Fila = { nom: string; comarca: string; valor: number };

const TOPS: Top[] = [
  { nom: "participacio-grans", metrica: "participacio", titolPropi: "On es va votar més el 2023, entre els municipis de més de 50.000 habitants", quants: 10, grup: "t8-9",
    tuit: (f, med) => `Participació a les municipals del 2023 entre les ciutats de més de 50.000 habitants: ${f[0]!.nom} al capdavant amb el ${n(f[0]!.valor, 1)} %; la mediana del grup, ${n(med, 1)} %. Font: Generalitat de Catalunya, processos electorals.` },
  { nom: "cens-creixement", metrica: "cens", titolPropi: "On el cens electoral ha crescut més des del 1979", quants: 10, grup: null,
    tuit: (f, med) => `El cens electoral d'${f[0]!.nom} ha crescut un ${n(f[0]!.valor, 0)} % entre les municipals del 1979 i les del 2023. La mediana dels 934 municipis amb dada de tots dos anys: +${n(med, 1)} %. Font: Generalitat de Catalunya.` },
  { nom: "ibi-rebut", metrica: "ibi", titolPropi: "Els rebuts mitjans d'IBI urbà més alts", quants: 10, grup: null,
    tuit: (f, med) => `El rebut mitjà d'IBI urbà més alt de Catalunya és el de ${f[0]!.nom}: ${n(f[0]!.valor, 0)} €. La mediana dels 931 municipis amb dada, ${n(med, 0)} €. És quota entre rebuts, no el tipus. Font: Idescat, 2025.` },
  { nom: "selectiva", metrica: "selectiva", titolPropi: "On es recicla més: recollida selectiva", quants: 10, grup: null,
    tuit: (f, med) => `${f[0]!.nom} és el municipi amb més recollida selectiva de Catalunya: ${n(f[0]!.valor, 1)} % dels residus. La mediana dels 947, ${n(med, 1)} %. Font: Agència de Residus de Catalunya, 2024.` },
  { nom: "renda-grans", metrica: "renda", titolPropi: "La renda de les llars, entre els municipis de més de 50.000 habitants", quants: 10, grup: "t8-9",
    tuit: (f, med) => `Renda mediana de les llars per unitat de consum a les ciutats de més de 50.000 habitants: ${f[0]!.nom} al capdavant amb ${n(f[0]!.valor, 0)} €; la mediana del grup, ${n(med, 0)} €. Font: INE, Atles de distribució de renda, 2023.` },
];

function filesDe(d: Dades, t: Top): { files: Fila[]; med: number; total: number } {
  const m = d.ranquings.metriques[t.metrica];
  if (!m) throw new Error(`el rànquing ${t.metrica} no és a la pàgina`);
  const totes = m.files
    .map(([i, v]) => ({ i, v, mun: d.ranquings.municipis[i]! }))
    .filter((x) => !t.grup || x.mun[3] === t.grup);
  const ordenades = [...totes].sort((a, b) => (t.menys ? a.v - b.v : b.v - a.v));
  return {
    files: ordenades.slice(0, t.quants).map((x) => ({ nom: x.mun[1], comarca: x.mun[2], valor: x.v })),
    med: mediana(totes.map((x) => x.v)),
    total: totes.length,
  };
}

function cos(d: Dades, t: Top, mida: Mida): string {
  const { files, med, total } = filesDe(d, t);
  const info = d.titolsRanquings[t.metrica] ?? { titol: t.metrica, font: "" };
  const m = d.ranquings.metriques[t.metrica]!;
  const maxim = Math.max(...files.map((f) => f.valor), med);
  const fmt = (v: number): string => `${n(v, Math.min(m.d, 1))}${m.s.startsWith("%") ? ` ${m.s}` : m.s}`;
  const quants = mida.nom === "4x5" ? files.length : Math.min(files.length, 10);
  const barres = files.slice(0, quants).map((f, i) => `
    <li>
      <span class="pos">${i + 1}</span>
      <span class="nom">${escape(f.nom)} <small>${escape(f.comarca)}</small></span>
      <span class="barra"><i style="width:${((f.valor / maxim) * 100).toFixed(1)}%"></i></span>
      <b class="valor">${escape(fmt(f.valor))}</b>
    </li>`).join("");
  const ambit = t.grup ? d.ranquings.grups[t.grup] ?? "" : `${n(total)} municipis amb dada`;
  return `<div class="marca">${logo(3)}</div>
<p class="etiqueta">Top ${quants} · ${escape(info.titol)}</p>
<div class="principal">
<h1 class="display titol">${escape(t.titolPropi)}</h1>
<div class="llista-caixa">
  <ol class="llista">${barres}</ol>
  <div class="mediana" style="left:calc(var(--inici) + (100% - var(--inici) - var(--final)) * ${(med / maxim).toFixed(3)})">
    <span>mediana ${escape(fmt(med))}</span>
  </div>
</div>
</div>
${peu(`${info.font} · mediana ${t.grup ? "del grup" : "de Catalunya"}: ${ambit}`)}`;
}

const CSS = `
.titol{font-size:3.6rem;margin-top:.8rem;max-width:80%}
body.vertical .titol{font-size:3.9rem;max-width:100%}
.llista-caixa{position:relative;margin-top:3.4rem;--inici:30rem;--final:10rem}
body.vertical .llista-caixa{--inici:24rem;--final:10rem;margin-top:3.8rem}
.llista{list-style:none;display:grid;gap:.75rem}
body.vertical .llista{gap:1.1rem}
.llista li{display:grid;grid-template-columns:2.6rem calc(var(--inici) - 2.6rem) 1fr var(--final);align-items:center;gap:0 1rem;height:2.9rem}
body.vertical .llista li{height:3.4rem}
.pos{font-family:Gabarito,sans-serif;font-weight:900;font-size:1.7rem;color:var(--coral)}
body.tinta .pos{color:var(--presec)}
.nom{font-weight:800;font-size:1.5rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nom small{font-weight:600;font-size:1.1rem;color:var(--suau);margin-left:.4rem}
.barra{display:block;height:2rem;background:rgba(30,27,46,.08);border-radius:.6rem;overflow:hidden}
body.tinta .barra{background:rgba(251,247,238,.12)}
.barra i{display:block;height:100%;background:var(--coral);border-radius:.6rem}
body.tinta .barra i{background:var(--lavanda)}
body.menta .barra i,body.lavanda .barra i,body.presec .barra i{background:var(--ink)}
.valor{font-family:Gabarito,sans-serif;font-weight:900;font-size:1.7rem;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.mediana{position:absolute;top:-1.4rem;bottom:-.4rem;border-left:.22rem dashed var(--tinta);pointer-events:none}
.mediana span{position:absolute;top:-1.6rem;left:-.1rem;transform:translateX(-50%);white-space:nowrap;font-size:1.05rem;font-weight:800;
  text-transform:uppercase;letter-spacing:.08em;background:var(--fons);padding:0 .5rem}
`;

export function propostesTop(d: Dades): Proposta[] {
  const fonsPer: Fons[] = ["paper", "tinta", "menta"];
  return TOPS.flatMap((t, i) => {
    const { files, med } = filesDe(d, t);
    const tuit = t.tuit(files, med);
    const enllac = `${OBS}/ranquings/#${t.metrica}`;
    return [1, 2].map((v) => ({
      familia: "top", nom: t.nom, variant: v, fons: fonsPer[(i + v - 1) % fonsPer.length]!, mides: ["16x9", "4x5"] as Mida["nom"][],
      tuit, enllac, css: CSS, cos: (m: Mida) => cos(d, t, m),
    }));
  });
}
