import { tintaSobre } from "./contrast";
import { RADIOGRAFIA_CSS } from "./estil";
import { SITE } from "./config";
import { slugify } from "../lib/text";

/**
 * Una pàgina per a cada persona que seu al ple.
 *
 * Són càrrecs públics electes i la seva identitat ja és oberta; el que aporta
 * la pàgina és reunir en un lloc el que avui està escampat: de quina llista va
 * sortir, en quina posició, si és a l'equip de govern, si va entrar el dia de
 * la constitució o a mig mandat, i què ha votat el seu grup.
 *
 * **Quan es pot dir què va votar aquesta persona, es diu.** Les actes no
 * publiquen una llista de vots individuals, però sovint no cal: si un grup de
 * divuit regidories hi posa divuit vots, tots divuit han votat allò. No és una
 * suposició sobre el que sol passar, és aritmètica —no queda ningú a qui
 * atribuir un vot diferent.
 *
 * Quan el grup hi posa menys vots que regidories té, algú no hi era o algú hi va
 * votar diferent, i llavors no es pot dir qui: aquells punts es marquen com a
 * vot del grup i no de la persona. És la diferència que importa, i és
 * precisament el cas on equivocar-se seria greu.
 *
 * El que no hi surt mai: cap dada de contacte, res que no derivi del càrrec, i
 * cap fotografia de qui no sigui electe en actiu.
 */

/** Un import en euros sencers, amb els milers a la catalana. */
const euros = (n: number): string => `${Math.round(n).toLocaleString("ca-ES")} €`;

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type Regidor = {
  nom: string;
  carrec: string;
  grup: string | null;
  sigles: string | null;
  color: string | null;
  equipGovern: boolean;
  foto: string | null;
  fitxaOficial: string | null;
  /** Posició a la llista amb què es va presentar, si l'hem pogut lligar. */
  posicioLlista: number | null;
  /** Va entrar després de la constitució del ple. */
  entradaTardana: boolean;
  /** Va deixar el grup pel qual va ser elegit. */
  canviDeGrup: { de: string | null; a: string | null } | null;
};

export type ContextRegidor = {
  municipi: string;
  slug: string;
  regidories: number;
  majoria: number;
  /**
   * Punts del ple votats pel seu grup. `tot` indica si el grup hi va votar
   * sencer: llavors el vot d'aquesta persona queda determinat.
   */
  votsDelGrup: {
    data: string;
    titol: string;
    sentit: string;
    url: string;
    tot: boolean;
    /** Diferència entre els dos costats. `null` si l'acta no dona el recompte. */
    marge: number | null;
    favor: number;
    contra: number;
  }[];
  /** Quantes actes s'han pogut llegir, per dir per què la llista és curta. */
  actesLlegides: number;
  /**
   * A quants plens ha anat, de quants en tenim la llista d'assistents.
   *
   * És l'única dada del projecte que és **de la persona i no del grup**:
   * assistir o no assistir a un ple no ho decideix ningú més. Per això va aquí
   * i no en cap altre lloc.
   */
  assistencia: { hi: number; de: number } | null;
  /**
   * L'adreça d'aquesta pàgina, la mateixa que ha fet servir qui l'ha escrita.
   *
   * El canònic la tornava a calcular amb `slugRegidor(r.nom)`, que no
   * desambigua: el dia que dues persones del mateix ple es diguin igual, la
   * pàgina «-2» es declararia canònica a l'adreça de l'altra i el cercador es
   * quedaria amb una de les dues. Avui no passa a cap dels 947, però el que ho
   * evita no ha de ser la sort: l'adreça la mana `adrecesRegidors()` i s'ha de
   * passar, no recalcular.
   */
  adreca: string;
  /**
   * Els càrrecs que aquesta persona ocupa en un altre ens, amb el que en cobra
   * quan qui la paga ho publica.
   *
   * Fins ara això només sortia a la fitxa del municipi, en una llista de nou
   * noms. És una dada **de la persona**, com l'assistència, i el lloc on la
   * busca qui la busca és la pàgina que porta el seu nom al títol. Les regles
   * són les mateixes d'allà i no es relaxen aquí: només hi va l'import que
   * publica l'ens que el paga, mai una suma dels dos càrrecs, i quan no el
   * publica es diu per què en comptes de deixar-ho en blanc.
   */
  altresCarrecs: {
    ens: string;
    carrec: string;
    anualBrut: number | null;
    concepte: string | null;
    dedicacio: string | null;
    motiuSenseImport: string | null;
    font: { nom: string; url: string } | null;
  }[];
  /** L'avís de la font sobre què és i què no és cadascun d'aquests imports. */
  avisRetribucions: string | null;
};

export const slugRegidor = (nom: string): string => slugify(nom);

/**
 * L'adreça de cada regidor del ple, calculada una sola vegada.
 *
 * Dues persones amb el mateix nom donarien el mateix slug i una escriuria
 * damunt de l'altra: desapareixeria del web sense que ho notés ningú. Es
 * desambigua amb un sufix, i com que la fitxa del municipi i el generador de
 * pàgines fan servir aquesta mateixa funció sobre la mateixa llista i en el
 * mateix ordre, l'enllaç i el directori no poden divergir.
 */
export function adrecesRegidors<T extends { nom: string }>(carrecs: readonly T[]): Map<T, string> {
  const vistos = new Set<string>();
  const sortida = new Map<T, string>();
  for (const carrec of carrecs) {
    let adreca = slugRegidor(carrec.nom);
    if (vistos.has(adreca)) {
      let n = 2;
      while (vistos.has(`${adreca}-${n}`)) n += 1;
      adreca = `${adreca}-${n}`;
    }
    vistos.add(adreca);
    sortida.set(carrec, adreca);
  }
  return sortida;
}

const SENTITS: Record<string, { text: string; grup: string; classe: string }> = {
  favor: { text: "hi va votar a favor", grup: "el seu grup hi va votar a favor", classe: "favor" },
  contra: { text: "hi va votar en contra", grup: "el seu grup hi va votar en contra", classe: "contra" },
  abstencio: { text: "s'hi va abstenir", grup: "el seu grup s'hi va abstenir", classe: "abstencio" },
  blanc: { text: "hi va votar en blanc", grup: "el seu grup hi va votar en blanc", classe: "" },
  absent: { text: "no hi era", grup: "el seu grup no hi era", classe: "" },
};

const CSS = `
.persona{display:flex;gap:var(--e3);align-items:center;flex-wrap:wrap;margin-top:var(--e3)}
.persona .retrat-gran{width:120px;height:120px;border-radius:var(--r-m);border:2.5px solid var(--ink);
  box-shadow:var(--ombra);object-fit:cover;background:var(--paper-2)}
.persona .inicials-gran{width:120px;height:120px;border-radius:var(--r-m);border:2.5px solid var(--ink);
  box-shadow:var(--ombra);display:flex;align-items:center;justify-content:center;
  font-family:var(--display);font-weight:900;font-size:2.6rem;background:var(--c,var(--paper-2));color:var(--t,inherit)}
.etiquetes{display:flex;gap:8px;flex-wrap:wrap;margin-top:var(--e2)}
.etiquetes span{border:2px solid var(--ink);border-radius:var(--r-max);padding:4px 14px;font-size:.8rem;font-weight:800}
.etiquetes .grup{background:var(--c,var(--paper-2));color:var(--t,inherit)}
.etiquetes .govern{background:var(--menta);color:#1E1B2E}
.etiquetes .oposicio{background:transparent}
.vots{list-style:none;padding:0;margin:var(--e3) 0 0}
.vots li{border-top:2.5px solid var(--ink);padding:var(--e2) 0;display:flex;gap:var(--e2);
  align-items:baseline;flex-wrap:wrap}
.vots .data{font-weight:800;font-size:.8rem;color:var(--ink-suau);font-variant-numeric:tabular-nums;
  white-space:nowrap}
.vots .titol{flex:1 1 16rem;min-width:0;overflow-wrap:anywhere}
.vots .sentit{font-size:.78rem;font-weight:800;border:2px solid var(--ink);border-radius:var(--r-max);padding:2px 11px}
.vots .sentit.favor{background:var(--menta);color:#1E1B2E}
.vots .sentit.contra{background:var(--coral);color:#FBF7EE}
.vots .sentit.abstencio{background:var(--presec);color:#1E1B2E}
/* Quan el vot és del grup i no es pot atribuir a la persona, la pastilla va
   buida: la diferència s'ha de veure sense haver de llegir el peu. */
.vots .sentit.del-grup{background:transparent!important;color:inherit!important;border-style:dashed}
.vots li.renyida{background:var(--paper-2);border-left:6px solid var(--coral);padding-left:var(--e2)}
.vots .recompte{display:block;font-size:.76rem;color:var(--ink-suau);font-weight:700;
  font-variant-numeric:tabular-nums;margin-top:3px}

/* --- què cobra d'un altre ens -------------------------------------------
   La mateixa peça que a la fitxa del municipi, però aquí és d'una sola
   persona: l'import gran, el concepte a sota i la font sempre a la vista.
   Sense import no hi va un buit sinó el motiu, que és el que distingeix «no
   en cobra» de «qui el paga no ho publica». */
.altres-carrecs{list-style:none;margin:var(--e2) 0 0;padding:0;display:grid;gap:var(--e2)}
.altres-carrecs li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:var(--ombra);padding:var(--e2) var(--e3);display:flex;flex-direction:column;gap:3px}
.altres-carrecs .ens{font-family:var(--display);font-weight:900;font-size:1.05rem;letter-spacing:-.01em}
.altres-carrecs .quin{display:block;font-family:var(--text);font-weight:700;font-size:.8rem;
  color:var(--ink-suau);letter-spacing:0;margin-top:2px}
.altres-carrecs .import{font-family:var(--display);font-weight:900;font-size:1.6rem;
  letter-spacing:-.03em;font-variant-numeric:tabular-nums;margin-top:6px}
.altres-carrecs .concepte{font-size:.82rem;color:var(--ink-suau);font-weight:700}
.altres-carrecs .buit{font-size:.9rem;color:var(--ink-suau);font-weight:700;margin-top:6px}
.altres-carrecs .font{margin-top:8px;font-size:.74rem;font-weight:800;color:var(--ink-suau);
  text-decoration:underline;text-decoration-color:var(--vora);text-underline-offset:2px;align-self:flex-start}
`;

/** Tinta llegible damunt del color del grup. Ho decideix `contrast.ts`. */
function tinta(color: string | null): string {
  if (!color) return "inherit";
  if (!/^#[0-9a-f]{3,8}$/i.test(color.trim())) return "inherit";
  return tintaSobre(color);
}

export function renderRegidor(r: Regidor, ctx: ContextRegidor, generatedAt: string): string {
  const inicials = r.nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const color = r.color ?? "#8b8b8b";
  const retrat = r.foto
    ? `<img class="retrat-gran" src="${escape(r.foto)}" alt="" width="120" height="120">`
    : `<span class="inicials-gran" style="--c:${color};--t:${tinta(color)}" aria-hidden="true">${escape(inicials)}</span>`;

  const vots = ctx.votsDelGrup
    .slice(0, 40)
    .map((v) => {
      const s = SENTITS[v.sentit] ?? { text: v.sentit, grup: v.sentit, classe: "" };
      const renyida = v.marge !== null && v.marge <= 2;
      return `<li${renyida ? ' class="renyida"' : ""}>
      <span class="data">${escape(v.data)}</span>
      <span class="titol"><a href="${escape(v.url)}" target="_blank" rel="noopener">${escape(v.titol)}</a>
        ${
          v.marge === null
            ? ""
            : `<span class="recompte">${v.favor} a favor · ${v.contra} en contra${renyida ? " · <b>per " + v.marge + (v.marge === 1 ? " vot" : " vots") + "</b>" : ""}</span>`
        }</span>
      <span class="sentit ${s.classe}${v.tot ? "" : " del-grup"}">${escape(v.tot ? s.text : s.grup)}</span>
    </li>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(r.nom)} · ${escape(ctx.municipi)} — Observatori municipal de quivoto</title>
<meta name="description" content="${escape(r.carrec)} de ${escape(ctx.municipi)}${
    r.grup ? ` pel grup ${escape(r.grup)}` : ""
  }: de quina llista va sortir, si és a l'equip de govern i què ha votat el seu grup al ple.">
<link rel="canonical" href="${SITE}/observatori/m/${escape(ctx.slug)}/regidor/${escape(ctx.adreca)}/">
<style>${RADIOGRAFIA_CSS}${CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>
<header class="capcalera">
  <a class="logo" href="/observatori/">Observatori</a>
  <span class="etiqueta">càrrec electe</span>
</header>

<main id="contingut">
  <section class="portada">
    <p class="micro"><a href="../../">${escape(ctx.municipi)}</a></p>
    <h1>${escape(r.nom)}</h1>
    <div class="persona">
      ${retrat}
      <div>
        <p class="entrada" style="margin:0">${escape(r.carrec)} de ${escape(ctx.municipi)}${
          r.grup ? `, pel grup <b>${escape(r.grup)}</b>` : ""
        }.</p>
        <div class="etiquetes">
          ${r.grup ? `<span class="grup" style="--c:${color};--t:${tinta(color)}">${escape(r.sigles ?? r.grup)}</span>` : ""}
          <span class="${r.equipGovern ? "govern" : "oposicio"}">${r.equipGovern ? "a l'equip de govern" : "a l'oposició"}</span>
          ${r.posicioLlista !== null ? `<span>número ${r.posicioLlista} de la llista</span>` : ""}
          ${r.entradaTardana ? `<span>va entrar a mig mandat</span>` : ""}
        </div>
      </div>
    </div>
    ${
      r.canviDeGrup
        ? `<p class="nota">Va ser elegit${/a$/i.test(r.carrec) ? "da" : ""} per
           <b>${escape(r.canviDeGrup.de ?? "una altra llista")}</b> i avui consta
           ${r.canviDeGrup.a ? `a <b>${escape(r.canviDeGrup.a)}</b>` : "sense grup"}.
           Ho diem perquè consta a les dues fonts, no com a retret: canviar de grup és legal i
           té motius que la nostra base de dades no coneix.</p>`
        : ""
    }
  </section>

  ${
    ctx.assistencia && ctx.assistencia.de >= 5
      ? `<section class="bloc">
    <h2>Quants plens ha fet</h2>
    <p class="entrada-bloc"><b>${ctx.assistencia.hi} de ${ctx.assistencia.de}</b> plens en què consta
    la llista d'assistents.</p>
    <p class="nota">Ho diu l'acta de cada sessió al seu capçal. No en tenim la llista de tots els
    plens: ${ctx.assistencia.de} de ${ctx.actesLlegides} actes llegides la porten, i les altres no
    diuen qui hi era. <b>Una absència no és una falta</b>: hi ha baixes, permisos i motius que
    l'acta no explica, i nosaltres tampoc.</p>
  </section>`
      : ""
  }

  ${
    ctx.altresCarrecs.length === 0
      ? ""
      : `<section class="bloc">
    <h2>Què cobra d'un altre ens</h2>
    <p class="entrada-bloc">${
      ctx.altresCarrecs.length === 1 ? "Ocupa també un càrrec" : `Ocupa també ${ctx.altresCarrecs.length} càrrecs`
    } fora de l'ajuntament. Aquí hi ha el que en publica qui el paga.</p>
    <ul class="altres-carrecs">${ctx.altresCarrecs
      .map(
        (a) => `<li>
        <span class="ens">${escape(a.ens)}${a.carrec ? `<span class="quin">${escape(a.carrec)}</span>` : ""}</span>
        ${
          a.anualBrut === null
            ? `<span class="buit">${escape(a.motiuSenseImport ?? "l'ens que el paga no en publica cap import")}</span>`
            : `<span class="import"><b>${euros(a.anualBrut)}</b> l'any bruts</span>
               <span class="concepte">${escape(a.concepte ?? "")}${
                 a.dedicacio ? ` (${escape(a.dedicacio)})` : ""
               }</span>`
        }
        ${a.font ? `<a class="font" href="${escape(a.font.url)}" rel="noopener nofollow">${escape(a.font.nom)}</a>` : ""}
      </li>`,
      )
      .join("")}</ul>
    ${
      // L'avís de la font ja diu que no s'hi suma cap total i per què el sou
      // municipal no hi surt: escriure-ho una segona vegada amb altres paraules
      // era dir dues vegades el mateix a dos paràgrafs seguits.
      ctx.avisRetribucions ? `<p class="nota oberta">${escape(ctx.avisRetribucions)}</p>` : ""
    }
  </section>`
  }

  <section class="bloc">
    <h2>Què ha votat</h2>
    ${
      ctx.votsDelGrup.length === 0
        ? `<p>${
            ctx.actesLlegides === 0
              ? `D'aquest ajuntament <b>encara no hem pogut llegir cap acta</b> amb el sentit del vot desglossat.`
              : `Hem llegit ${ctx.actesLlegides} actes d'aquest ajuntament, però <b>cap no desglossa el vot per grup</b>.`
          }
           Sense això no podem dir què s'hi ha votat, i preferim dir-ho a omplir-ho amb suposicions.</p>`
        : `<p class="entrada-bloc">Els punts que el ple va votar de manera dividida i on consta el
           sentit del vot del seu grup, <b>començant pels més renyits</b>. Un punt aprovat per
           tothom no separa ningú; un decidit per un vot o dos és on es veu qui és qui.</p>
           <ul class="vots">${vots}</ul>
           ${ctx.votsDelGrup.length > 40 ? `<p class="nota">Se n'ensenyen 40 dels ${ctx.votsDelGrup.length}.</p>` : ""}`
    }
    <p class="nota">Les actes no publiquen una llista de vots individuals, però sovint no cal:
    <b>quan un grup hi posa tants vots com regidories té, tots els seus regidors hi han votat
    allò</b>, perquè no queda ningú a qui atribuir un vot diferent. En aquests punts hi diu què va
    votar aquesta persona. Quan el grup hi va posar menys vots que regidories —algú no hi era, o
    algú hi va votar a part— no es pot saber qui, i llavors hi diu «el seu grup».</p>
  </section>

  <section class="bloc anar">
    <h2>Segueix estirant</h2>
    <ul class="destins">
      <li><a href="../../"><b>La fitxa de ${escape(ctx.municipi)}</b>
        <span>El ple sencer, qui governa, els comptes i les dotze eleccions des del 1979</span></a></li>
      ${
        r.sigles
          ? `<li><a href="../../${escape(slugify(r.sigles))}/"><b>${escape(r.sigles)} a ${escape(ctx.municipi)}</b>
        <span>Els resultats de la candidatura i qui hi va anar a la llista</span></a></li>`
          : ""
      }
    </ul>
  </section>

  <section class="bloc fonts">
    <h2>D'on surt</h2>
    <p class="nota">Composició del ple segons la seu electrònica del mateix ajuntament i el
    registre d'electes de la Generalitat. Hi publiquem nom, càrrec, grup i mandat, que és el que
    deriva del càrrec públic; <b>cap dada de contacte</b>. La fotografia, quan n'hi ha, la publica
    el mateix ajuntament al seu portal de transparència${
      r.fitxaOficial
        ? ` (<a href="${escape(r.fitxaOficial)}" target="_blank" rel="noopener">fitxa original</a>)`
        : ""
    }, i la retirem a la primera petició de la persona, sense demanar-ne el motiu.</p>
  </section>
</main>

<footer class="peu"><p>quivoto · Observatori municipal · generat el ${escape(generatedAt)}</p></footer>
</body></html>`;
}
