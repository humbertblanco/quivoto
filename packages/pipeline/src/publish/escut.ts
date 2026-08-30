/**
 * L'escut i la fotografia del poble, i el crèdit que la llicència obliga a fer.
 *
 * J26 les ha baixades de Wikimedia Commons i les ha desades a
 * `web/public/observatori/escuts/` i `.../vistes/` amb el codi INE al nom. Aquí
 * només es dibuixen, i es dibuixa **també l'atribució**, que no és un adorn:
 * l'escut d'Abrera és `CC BY-SA 4.0` i publicar-lo sense el nom de la llicència
 * i sense l'enllaç a la pàgina del fitxer és incomplir-la. Amb 877 escuts i 916
 * fotografies, oblidar-se'n una vegada és oblidar-se'n mil.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ON VA EL CRÈDIT, I PER QUÈ NO VA TOT AL MATEIX LLOC
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Les dues imatges no es miren igual i per això no se citen igual:
 *
 *   · **La fotografia** ocupa l'amplada de la columna i és el primer que es veu
 *     de la fitxa. El crèdit va **just a sota**, dins del mateix `<figure>`:
 *     enganxat a la imatge que descriu, que és on qui la vulgui reutilitzar el
 *     buscarà. A 0,8 rem i amb el gris secundari de la casa (5,1:1 sobre el
 *     paper, per damunt del 4,5:1 que es demana) es llegeix sense competir amb
 *     cap xifra.
 *   · **L'escut** surt al costat del nom, a 44 px. Un crèdit allà mataria el
 *     titular, i convertir la imatge en enllaç posaria una destinació externa
 *     de 44 px arran de l'`h1`, que en un telèfon és una trampa. El seu crèdit
 *     va al bloc de fonts del final, amb l'enllaç a Commons dins del text, que
 *     és on la resta de dades de la fitxa també diuen d'on surten.
 *
 * Quan Commons no declara autor —passa a molts escuts, que són obra
 * institucional antiga— **igualment se cita el fitxer i la llicència**: la
 * BY d'una CC BY-SA sense autor conegut es compleix identificant l'obra i
 * enllaçant-ne l'origen, no callant.
 *
 * I una còpia reduïda és una **obra derivada**: la CC BY-SA obliga a dir-ho.
 * Les fotografies es publiquen reduïdes a 1.024 px i el crèdit ho escriu; els
 * escuts SVG es publiquen verbatim i no ho diuen perquè no és cert.
 *
 * Del text de la Viquipedia, ni una línia. És CC BY-SA i el share-alike
 * obligaria a etiquetar aquell tros de pàgina amb una llicència diferent de la
 * resta del lloc. L'enllaç sí, i el posa la fitxa.
 */

/**
 * Una imatge desada per J26.
 *
 * El tipus es declara aquí i no s'importa de la feina, com ja fa `radiografia.ts`
 * amb la fitxa de càrrecs: la publicació ha de poder dibuixar el que li donin
 * sense arrossegar-se mitja ingesta, i el dia que el JSON desat canviï de forma
 * el compilador el trobarà igualment allà on es carrega.
 */
export type ImatgeMunicipi = {
  mena: "escut" | "vista";
  /** Camí públic del fitxer: `/observatori/escuts/08001.svg`. */
  cami: string;
  format: "svg" | "webp";
  /** Mides reals; `null` als SVG, que no en tenen de fixes. */
  amplada: number | null;
  alcada: number | null;
  /** Cert si el que servim és una còpia reduïda i no el fitxer original. */
  derivada: boolean;
  /** Títol a Commons, que és el que identifica l'obra. */
  fitxer: string;
  /** Pàgina de descripció del fitxer: l'enllaç obligatori. */
  pagina: string;
  llicencia: string;
  llicenciaNom: string;
  autor: string | null;
};

/** El que la fitxa d'un municipi en té, tal com ho desa J26. */
export type ImatgesMunicipi = {
  escut: ImatgeMunicipi | null;
  vista: ImatgeMunicipi | null;
};

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ─────────────────────────────────────────────────────────────────────────────
// El nom del poble dins d'una frase
// ─────────────────────────────────────────────────────────────────────────────

/** L'ordre importa: «els» s'ha de mirar abans que «el». */
const CONTRACCIONS: [RegExp, string][] = [
  [/^els\s+/i, "dels "],
  [/^el\s+/i, "del "],
  [/^les\s+/i, "de les "],
  [/^la\s+/i, "de la "],
];

/**
 * «Abrera» → «d'Abrera»; «el Prat de Llobregat» → «del Prat de Llobregat».
 *
 * Surt al text alternatiu de cada imatge, i el text alternatiu és el nom del
 * poble per a qui llegeix amb veu: «Escut de el Prat» no és una errada petita,
 * és el que sentiria 947 vegades qui recorregués l'Observatori amb un lector de
 * pantalla. Els noms de la nostra taula ja porten l'article davant i en
 * minúscula, que és la forma catalana correcta.
 */
export function deMunicipi(nom: string): string {
  const net = nom.trim();
  // Davant d'apòstrof no hi ha contracció: «de l'Hospitalet de Llobregat».
  if (/^l['’]/i.test(net)) return `de ${net}`;
  const contraccio = CONTRACCIONS.find(([patro]) => patro.test(net));
  if (contraccio) return `${contraccio[1]}${net.replace(contraccio[0], "")}`;
  return /^[aeiouàèéíòóúh]/i.test(net) ? `d'${net}` : `de ${net}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// El crèdit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'enllaç al text de la llicència a partir del codi de Commons.
 *
 * La CC demana que el nom de la llicència porti al text, i el codi ja el diu
 * tot: `cc-by-sa-4.0` és `by-sa` versió `4.0`. El que no encaixi en aquest
 * patró —els codis de domini públic— no en té cap, i llavors el nom es queda
 * sense enllaç en comptes d'inventar-se'n un que no existeix.
 */
export function urlLlicencia(codi: string): string | null {
  const net = codi.trim().toLowerCase();
  if (/^cc0(-1\.0)?$/.test(net)) return "https://creativecommons.org/publicdomain/zero/1.0/";
  const cc = net.match(/^cc-(by(?:-sa)?)-(\d(?:\.\d+)?)$/);
  if (cc) return `https://creativecommons.org/licenses/${cc[1]}/${cc[2]}/`;
  return null;
}

/** «Escut» o «Fotografia»: qui llegeix el crèdit ha de saber de què parla. */
const ETIQUETA: Record<ImatgeMunicipi["mena"], string> = { escut: "Escut", vista: "Fotografia" };

/**
 * L'atribució d'una imatge, en una línia.
 *
 * Hi ha d'haver, per aquest ordre: què és, qui la va fer (si se sap), sota
 * quina llicència, i on és l'original. Els quatre elements són el que exigeix
 * la CC BY-SA 4.0, i el quart —l'enllaç a la pàgina de Commons— és a més el que
 * permet a qualsevol comprovar els altres tres.
 */
export function credit(imatge: ImatgeMunicipi | null): string {
  if (imatge === null) return "";
  const url = urlLlicencia(imatge.llicencia);
  const llicencia = url
    ? `<a href="${escape(url)}" rel="license noopener nofollow">${escape(imatge.llicenciaNom)}</a>`
    : `<b>${escape(imatge.llicenciaNom)}</b>`;
  const autor = imatge.autor
    ? `de ${escape(imatge.autor)}`
    : // Sense autor conegut, l'obra s'identifica pel seu nom de fitxer: és el
      // que fa que l'atribució segueixi sent comprovable.
      "d'autoria no declarada a Commons";
  const nom = escape(imatge.fitxer.replace(/^File:/, ""));
  return `<p class="credit-imatge">${ETIQUETA[imatge.mena]}: <a href="${escape(imatge.pagina)}" rel="noopener nofollow">${nom}</a>, ${autor}, ${llicencia}${
    imatge.derivada ? ", reduïda per quivoto" : ""
  }. Wikimedia Commons.</p>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les dues peces
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionsEscut = {
  /** Nom del municipi, per al text alternatiu. */
  municipi: string;
  /** Alçada en píxels. Per defecte 44, la mida al costat del nom. */
  mida?: number;
};

/**
 * L'escut petit al costat del nom.
 *
 * Torna cadena buida quan no n'hi ha: **70 municipis dels 947 no en tenen a
 * Commons**, i posar-hi una silueta grisa assenyalaria qui no en té sense
 * afegir cap informació. Un forat que no es veu val més que un forat dibuixat.
 *
 * Va sense enllaç i amb `alt` descriptiu; el crèdit el posa `credit()` al bloc
 * de fonts. L'alçada mana i l'amplada s'ajusta sola, perquè els escuts no són
 * quadrats i cadascun té la seva proporció.
 */
export function escutMunicipi(fitxa: ImatgesMunicipi | null, opcions: OpcionsEscut): string {
  const escut = fitxa?.escut ?? null;
  if (escut === null) return "";
  const mida = opcions.mida ?? 44;
  return `<img class="escut" src="${escape(escut.cami)}" alt="Escut ${escape(deMunicipi(opcions.municipi))}" height="${mida}" style="--escut-mida:${mida}px" loading="lazy" decoding="async">`;
}

export type OpcionsVista = {
  municipi: string;
  /**
   * Càrrega immediata. La fotografia acostuma a ser el primer que es veu de la
   * fitxa, i una imatge mandrosa que hi és de seguida només fa parpellejar la
   * pàgina; per a la resta de llocs, mandrosa.
   */
  primerCop?: boolean;
};

/**
 * La fotografia del poble, amb el seu crèdit a sota.
 *
 * El text alternatiu diu de quin poble és i prou. **No descrivim el que no hem
 * mirat**: inventar «vista del campanar des del riu» per a 916 fotografies que
 * ningú d'aquí no ha obert seria posar-hi ficció, i qui llegeix amb veu es
 * mereix que el que li diem sigui cert.
 *
 * Les mides van al `width` i l'`height` perquè el navegador reservi l'espai
 * abans de tenir la imatge: sense això, tot el que hi ha a sota fa un salt quan
 * arriba, i el que hi ha a sota és la dada.
 */
export function vistaMunicipi(fitxa: ImatgesMunicipi | null, opcions: OpcionsVista): string {
  const vista = fitxa?.vista ?? null;
  if (vista === null) return "";
  const mides =
    vista.amplada !== null && vista.alcada !== null
      ? ` width="${vista.amplada}" height="${vista.alcada}"`
      : "";
  const carrega = opcions.primerCop ? "" : ' loading="lazy"';
  return `<figure class="vista">
  <img src="${escape(vista.cami)}" alt="Fotografia ${escape(deMunicipi(opcions.municipi))}"${mides}${carrega} decoding="async">
  ${credit(vista)}
</figure>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// L'estil
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Va a `RADIOGRAFIA_CSS`, com la resta: cada fitxa és un fitxer autònom i no
 * carrega cap full d'estil de fora.
 *
 * Els escuts estan dibuixats per veure's damunt de paper blanc, i en fosc n'hi
 * ha que es fonen amb el fons: els que són silueta negra desapareixen sencers.
 * Per això, i **només en fosc**, l'escut va damunt d'una placa clara amb un pèl
 * de marge. En clar no en porta cap: una caixa al voltant de l'escut al costat
 * del titular seria soroll.
 */
export const ESCUT_CSS = `
/* --- l'escut al costat del nom -----------------------------------------
   El titular mana i l'escut l'acompanya: per això la fila s'alinea per la base
   del text i no pel centre de la imatge. Quan el nom és llarg —«Sant Quirze
   Safaja»— la fila embolcalla i l'escut es queda a dalt, que és on serveix. */
.titol-amb-escut{display:flex;align-items:center;gap:var(--e2);flex-wrap:wrap}
.escut{height:var(--escut-mida,44px);width:auto;flex:none;display:block}
@media (prefers-color-scheme: dark){
  /* El color va escrit a pèl i no com a token a posta: aquí dins tots els
     tokens ja s'han girat i el que necessitem és justament el que no es gira,
     el paper clar de sempre, perquè l'escut es continuï veient com el van
     dibuixar. */
  .escut{background:#FBF7EE;border-radius:6px;padding:3px;box-sizing:content-box}
}

/* --- la fotografia del poble -------------------------------------------
   Omple la columna amb la seva proporció: l'enquadrament és de qui va fer la
   fotografia i aquí no es toca. L'única excepció és el vertical extrem —n'hi
   ha de 3.000 px d'alt— que ocuparia la pantalla sencera i deixaria la dada
   fora de camp; per sobre de mitja finestra, sí que es retalla. */
.vista{margin:0 0 var(--e3)}
.vista img{display:block;width:100%;height:auto;max-height:52vh;object-fit:cover;
  border-radius:var(--r-m);border:1px solid var(--vora);background:var(--paper-2)}

/* --- el crèdit ----------------------------------------------------------
   0,8 rem sobre 17 px són 13,6 px: prou petit per no competir amb cap xifra i
   prou gran per llegir-se, que és exactament el que ha de ser una atribució
   obligatòria. El gris és el secundari de la casa, 5,1:1 damunt del paper. */
.credit-imatge{font-size:.8rem;line-height:1.4;color:var(--ink-suau);margin:6px 0 0}
.credit-imatge a{color:inherit;text-decoration:underline;text-decoration-thickness:1px}
.credit-imatge a:hover{color:var(--coral-text)}
`;
