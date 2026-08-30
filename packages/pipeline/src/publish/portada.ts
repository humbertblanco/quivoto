import { RADIOGRAFIA_CSS } from "./estil";
import { SITE } from "./config";
import { MASCOTA_CSS, catalunya } from "./mascota";
import { capcalera } from "./capcalera";
import { cercador } from "./cercador";
import { peu } from "./peu";

/**
 * La portada de l'Observatori.
 *
 * Era un fitxer escrit a mà amb dues targetes, i mentre el projecte creixia va
 * anar quedant enrere: no enllaçava ni el comparador, ni les comarques, ni les
 * descàrregues, ni les preguntes. Qui hi arribava veia una desena part del que
 * hi ha. Ara es genera amb la resta, i els números que hi surten són els que
 * s'acaben de publicar, no una xifra escrita a mà que envelleix sola.
 */

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type ComptesPortada = {
  municipis: number;
  comarques: number;
  candidatures: number;
  fitxersDades: number;
  conjuntsPreguntes: number;
  /** Municipis de l'Àrea Metropolitana, o null si encara no s'ha ingerit. */
  amb: number | null;
  /** El municipi de la fitxa d'exemple: el que té les preguntes més sòlides. */
  exemple: { slug: string; nom: string } | null;
  /** El que té demostració de preguntes, per enllaçar-la des de la portada. */
  provaDestacada: { slug: string; nom: string } | null;
};

const CSS = `
.reixa{list-style:none;padding:0;margin:var(--e4) 0 0;display:grid;gap:var(--e3);
  grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.reixa a{display:block;height:100%;background:var(--paper-2);border:2.5px solid var(--ink);
  border-radius:var(--r-l);box-shadow:var(--ombra);padding:var(--e3);text-decoration:none;color:inherit;
  transition:transform .12s ease,box-shadow .12s ease}
.reixa a:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.reixa b{font-family:var(--display);font-weight:900;font-size:1.3rem;letter-spacing:-.02em;display:block;margin-bottom:4px}
.reixa span{color:var(--ink-suau);font-size:.92rem;display:block}
.reixa .marca{display:inline-block;margin-bottom:8px;background:var(--menta);color:#1E1B2E;
  border:1.5px solid var(--ink);border-radius:var(--r-max);padding:2px 10px;font-size:.66rem;
  font-weight:800;text-transform:uppercase;letter-spacing:.08em}
.reixa .marca.nou{background:var(--coral);color:#FBF7EE}
.xifres{list-style:none;padding:0;margin:var(--e4) 0 0;display:flex;flex-wrap:wrap;gap:var(--e3)}
.xifres li{flex:1 1 120px}
.xifres b{display:block;font-family:var(--display);font-weight:900;font-size:clamp(1.8rem,6vw,2.6rem);
  letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
.xifres span{color:var(--ink-suau);font-size:.84rem;font-weight:700}
`;

export function renderPortada(comptes: ComptesPortada, generatedAt: string): string {
  const exemple = comptes.exemple ?? { slug: "esplugues-de-llobregat", nom: "Esplugues de Llobregat" };
  const targetes: string[] = [
    `<li><a href="els947.html"><span class="marca">tot Catalunya</span>
      <b>Els 947</b>
      <span>Tots els municipis en una llista, amb cercador i filtres: on hi va haver pacte,
      on ha canviat l'alcaldia a mig mandat, on mana sempre la mateixa força, on no hi ha oposició.</span></a></li>`,
    `<li><a href="m/${escape(exemple.slug)}/"><span class="marca">una per municipi</span>
      <b>La fitxa d'un poble</b>
      <span>Qui mana i amb qui, el ple amb nom i cognoms, les dotze eleccions des del 1979,
      els comptes, els impostos i què en sabem i què no. N'hi ha una per a cadascun dels ${comptes.municipis}.</span></a></li>`,
    `<li><a href="mapa/"><span class="marca nou">mapa</span>
      <b>El mapa dels 947</b>
      <span>Catalunya sencera, municipi a municipi: on hi ha majoria absoluta, on no governa qui
      va guanyar, on ha canviat l'alcaldia a mig mandat i on mana la mateixa força des del 1979.</span></a></li>`,
    `<li><a href="comparador/"><span class="marca">costat a costat</span>
      <b>El comparador</b>
      <span>Posa fins a quatre municipis un al costat de l'altre i mira'ls amb la mateixa vara:
      deute, despesa per habitant, impostos, participació i fragmentació del ple.</span></a></li>`,
    `<li><a href="c/barcelones/"><span class="marca">${comptes.comarques} comarques</span>
      <b>Qui mana a la comarca</b>
      <span>Quantes alcaldies té cada força, com queda cada municipi respecte de la mitjana
      comarcal i on són les excepcions.</span></a></li>`,
    ...(comptes.amb
      ? [
          `<li><a href="amb/"><span class="marca nou">${comptes.amb} municipis</span>
      <b>L'Àrea Metropolitana</b>
      <span>Què decideix l'AMB i què no: el transport, l'aigua, els residus, les platges i
      l'habitatge de ${comptes.amb} municipis de cinc comarques diferents, amb l'article de la
      llei al costat.</span></a></li>`,
        ]
      : []),
    `<li><a href="dades/"><span class="marca">obertes</span>
      <b>Baixa't les dades</b>
      <span>${comptes.fitxersDades} fitxers en CSV i JSON, amb l'esquema documentat camp a camp
      i la font de cada xifra. Perquè ens puguis comprovar i reutilitzar.</span></a></li>`,
  ];
  if (comptes.conjuntsPreguntes > 0) {
    targetes.push(`<li><a href="preguntes/"><span class="marca nou">demostració</span>
      <b>Les preguntes</b>
      <span>Les 25 preguntes que la brúixola farà, escrites llegint les actes del ple.
      ${comptes.conjuntsPreguntes} municipis, i ja es poden respondre${
        comptes.provaDestacada
          ? `: prova-ho a <b style="display:inline;font-size:inherit">${escape(comptes.provaDestacada.nom)}</b>`
          : ""
      }.</span></a></li>`);
  }

  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Observatori municipal · quivoto</title>
<meta name="description" content="Els ${comptes.municipis} municipis de Catalunya amb dades obertes: qui governa, resultats des del 1979, comptes, impostos, el ple i les actes.">
<link rel="canonical" href="${SITE}/observatori/">
<style>${RADIOGRAFIA_CSS}${MASCOTA_CSS}${CSS}</style>
</head>
<body>
<a class="salta" href="#contingut">Ves al contingut</a>
${capcalera("./", "portada")}
${cercador("./")}

<main id="contingut">
  <section class="portada">
    <div class="presenta">${catalunya(150, "felic", null)}<div>
      <p class="micro">Observatori</p>
      <h1>Els ${comptes.municipis} municipis</h1>
    </div></div>
    <p class="entrada">Tot Catalunya, poble a poble, amb el que en diuen les dades obertes.
    <b>Sense cap model de llenguatge pel mig</b>: són fonts oficials i càlculs que qualsevol
    pot repetir, amb la font de cada xifra al costat.</p>
    <ul class="xifres">
      <li><b>${comptes.municipis}</b><span>fitxes municipals</span></li>
      <li><b>${comptes.candidatures}</b><span>pàgines de candidatura</span></li>
      <li><b>${comptes.comarques}</b><span>comarques</span></li>
      <li><b>${comptes.fitxersDades}</b><span>fitxers de dades</span></li>
      ${comptes.amb ? `<li><b>${comptes.amb}</b><span>municipis metropolitans</span></li>` : ""}
    </ul>
  </section>

  <ul class="reixa">${targetes.join("")}</ul>

  <section class="bloc fonts">
    <h2>Per què això i no un portal de dades</h2>
    <p>El 23 de maig del 2027 hi ha eleccions municipals. La pregunta que volem que es pugui
    respondre és <b>«què han fet aquests quatre anys al meu poble i què m'hi jugo»</b>, no
    «quantes taules estadístiques som capaços de publicar». Una dada que no ajuda a decidir
    un vot no entra, per bona que sigui.</p>
  </section>
</main>
${peu("./", generatedAt)}
</body></html>`;
}
