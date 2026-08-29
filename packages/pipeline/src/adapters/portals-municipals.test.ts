import { describe, expect, it } from "vitest";
import {
  CERDANYOLA,
  GIRONA,
  GRANOLLERS,
  MANRESA,
  PORTALS,
  PORTALS_DESCARTATS,
  PortalError,
  RUBI,
  SANT_CUGAT,
  VILANOVA,
  dataCatalana,
  dataCerdanyola,
  dataDdMmAa,
  decodeixHtml,
  enllacos,
  nomFitxer,
  sessionsVideoacta,
  urlIndexRubi,
  urlSessioGava,
  votacionsGava,
} from "./portals-municipals";

/**
 * Tots els retalls d'aquest fitxer són **literals**, copiats de l'índex real de
 * cada portal el 29 d'agost del 2026, amb les cometes i els espais tal com els
 * serveix el servidor. No estan endreçats a posta: mitja prova d'aquest fitxer
 * consisteix justament a no espantar-se davant d'atributs amb cometes simples
 * (Girona), d'un enllaç que només diu «PDF» (Manresa), d'un títol que viu a
 * l'`alt` d'una imatge (Granollers) o d'una data enganxada sense separadors
 * (Cerdanyola).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Girona
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Girona serveix els atributs amb cometes **simples** i posa el mateix parell
 * ordre-del-dia/acta per a cada sessió. La segona fila és de l'índex del 2023,
 * on el camí i el nom del fitxer són uns altres: `/portal/dades/` en comptes de
 * `/cdn/dades/` i `ActaPle-` en comptes de `Acta-Ple-`. És el cas que demostra
 * per què no es poden construir les URL.
 */
const HTML_GIRONA = `
<a href='https://seu.girona.cat/cdn/dades/actes_plenaries/_descarrega/Ordre-dia-Ple-10-11-25.pdf' title='Ordre del dia' target='_blank'>Ordre del dia - 17 h</a>
<a href='https://seu.girona.cat/cdn/dades/actes_plenaries/_descarrega/Acta-Ple-10-11-25.pdf' title='Acta' target='_blank'>Acta</a>
<a href='https://seu.girona.cat/cdn/dades/actes_plenaries/_descarrega/Acta-Ple-Extraordinari-20-06-25.pdf' title='Acta' target='_blank'>Acta</a>
<a href='https://seu.girona.cat/portal/dades/actes_plenaries/_descarrega/ActaPle-22-12-23.pdf' title='Acta' target='_blank'>Acta</a>
<a href='https://seu.girona.cat/cdn/dades/actes_plenaries/_descarrega/Ordre-dia-ple-28-07-2025.pdf' title='Ordre del dia' target='_blank'>Ordre del dia</a>
<a href='../docs/Disposicio-SalodePlens-2023-2027.pdf'>Disposici&oacute; dels membres del consistori al Sal&oacute; de Plens</a>
`;

describe("Girona", () => {
  const documents = GIRONA.extreu(HTML_GIRONA, "https://www.girona.cat/transparencia/cat/acords_ple2025.php");

  it("separa les actes dels ordres del dia i ignora la resta de PDF", () => {
    expect(documents.map((d) => `${d.mena} ${d.data}`)).toEqual([
      "ordre_del_dia 2025-11-10",
      "acta 2025-11-10",
      "acta 2025-06-20",
      "acta 2023-12-22",
      "ordre_del_dia 2025-07-28",
    ]);
    // La disposició del saló de plens no és cap sessió i no hi ha de ser.
    expect(documents.some((d) => d.url.includes("SalodePlens"))).toBe(false);
  });

  it("no perd les actes del 2023, que tenen un altre camí i un altre nom", () => {
    const antiga = documents.find((d) => d.data === "2023-12-22")!;
    expect(antiga.url).toBe(
      "https://seu.girona.cat/portal/dades/actes_plenaries/_descarrega/ActaPle-22-12-23.pdf",
    );
  });

  it("llegeix la data de l'any de quatre xifres quan el fitxer la porta així", () => {
    // `Ordre-dia-ple-28-07-2025.pdf` no encaixa amb `dd-mm-aa`; si no hi hagués
    // la segona passada, aquesta fila quedaria sense data.
    expect(documents.find((d) => d.url.endsWith("28-07-2025.pdf"))!.data).toBe("2025-07-28");
  });

  it("demana un índex per any i el de l'any en curs sense sufix", () => {
    expect(GIRONA.urlsIndex({ anys: [2026, 2025] })).toEqual([
      "https://www.girona.cat/transparencia/cat/acords_ple.php",
      "https://www.girona.cat/transparencia/cat/acords_ple2025.php",
    ]);
  });
});

/**
 * L'índex de Girona és ISO-8859-1 i **no ho diu enlloc**: ni a la capçalera
 * (`Content-Type: text/html` a seques) ni en cap `meta`. Llegit com a UTF-8,
 * el títol es trenca i les dates en català deixen d'aparellar.
 */
describe("decodeixHtml", () => {
  const latin1 = Uint8Array.from([0x50, 0x6c, 0x65, 0x6e, 0xe0, 0x72, 0x69, 0x65, 0x73]); // «Plenàries»

  it("cau a windows-1252 quan no hi ha charset i el cos no és UTF-8 vàlid", () => {
    expect(decodeixHtml(latin1, "text/html")).toBe("Plenàries");
  });

  it("fa cas de la capçalera quan la porta", () => {
    expect(decodeixHtml(latin1, "text/html; charset=ISO-8859-1")).toBe("Plenàries");
  });

  it("fa cas del meta del document quan la capçalera calla", () => {
    const utf8 = new TextEncoder().encode('<meta charset="utf-8"><p>Plenàries</p>');
    expect(decodeixHtml(utf8, null)).toContain("Plenàries");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Manresa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A Manresa el text de l'enllaç només diu «PDF»: el títol de la sessió és un
 * `div` germà, dins del mateix `<li>`. I al costat hi ha una icona de Material
 * Icons, que és la paraula «description» escrita dins d'un `<i>` i que, si no
 * es treu, queda enganxada al davant del títol.
 */
const HTML_MANRESA = `
<li>
            <div class="collapsible-header" onClick="collapsibleToggle(this)">
                <div style="padding-left:calc(20px*1)">
                                    <div style="float:left">
                        <i class="material-icons">
                            description
                        </i>
                    </div>
                    <div style="padding-bottom: 10px;">
                        Acta de la sessió plenària núm. 1, de 26 de gener de 2023
                    </div>
                    <div style="padding-left: 24px;">
                        <a class="btn" href="https://web.manresa.cat/media/docs/arxius/2023_01_26_acta_web_ple_1.pdf" target="_blank" data-format="PDF">

                            PDF
                        </a>
                                                                    </div>
                                </div>
            </div>
            <div class="collapsible-body">

                            </div>
        </li>
<li>
  <div class="collapsible-header">
    <div><i class="material-icons">description</i></div>
    <div>Acta de la sessió plenària de 21 de maig de 2026</div>
    <div><a class="btn" href="https://web.manresa.cat/media/docs/arxius//2026_05_21_acta_web_ple.pdf" data-format="PDF">PDF</a></div>
  </div>
</li>
<li>
  <div class="collapsible-header">
    <div>Ordenança fiscal reguladora de l'IBI</div>
    <div><a class="btn" href="https://web.manresa.cat/media/docs/arxius/ordenanca.pdf" data-format="PDF">PDF</a></div>
  </div>
</li>
`;

describe("Manresa", () => {
  const documents = MANRESA.extreu(HTML_MANRESA, "https://web.manresa.cat/web/menu/4444-plens-actes");

  it("agafa el títol del bloc i no el text de l'enllaç", () => {
    expect(documents).toHaveLength(2);
    expect(documents[0]!.titol).toBe("Acta de la sessió plenària núm. 1, de 26 de gener de 2023");
    // La icona no hi és: «description» no forma part del títol.
    expect(documents[0]!.titol).not.toContain("description");
    expect(documents[0]!.mena).toBe("acta");
  });

  it("pren la data del nom del fitxer, que hi és en aaaa_mm_dd", () => {
    expect(documents.map((d) => d.data)).toEqual(["2023-01-26", "2026-05-21"]);
  });

  it("no es queda amb els PDF del mateix índex que no són del ple", () => {
    expect(documents.some((d) => d.url.includes("ordenanca"))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cerdanyola del Vallès
// ─────────────────────────────────────────────────────────────────────────────

const HTML_CERDANYOLA = `
<a href="https://www.cerdanyola.cat/sites/default/files/fitxers/0001_01.actasessiordinriaplemunicipal3012025.pdf" type="application/pdf; length=2132616" title="acta ple gener 2025" target="_blank">Acta de la sessió plenària Gener 2025</a>
<a href="https://www.cerdanyola.cat/sites/default/files/fitxers/0006_06.actasessiordinriaplemunicipal2952025.pdf" target="_blank">Acta de la sessió plenària Maig 2025</a>
<a href="https://www.cerdanyola.cat/sites/default/files/fitxers/0004_04.actasessiextraordinriaplemunicipal1042025_0.pdf" target="_blank">Acta de la sessió extraordinària Abril 2025</a>
<a href="https://www.cerdanyola.cat/sites/default/files/fitxers/acta_sessio_ple_30-4-2025_censurat.pdf" target="_blank">Acta de la sessió plenària Abril 2025</a>
<a href="https://www.cerdanyola.cat/sites/default/files/fitxers/convocatoria.pdf">Convocatòria del Ple de gener</a>
`;

describe("Cerdanyola del Vallès", () => {
  const documents = CERDANYOLA.extreu(HTML_CERDANYOLA, "https://www.cerdanyola.cat/actes-del-ple-2025");

  it("només es queda les actes", () => {
    expect(documents).toHaveLength(4);
    expect(documents.every((d) => d.mena === "acta")).toBe(true);
  });

  it("desfà l'ambigüitat de la data amb la convenció de no posar zeros al davant", () => {
    expect(documents.map((d) => d.data)).toEqual([
      // «3012025» → 30/1, no 3/01: el mes no porta zero.
      "2025-01-30",
      "2025-05-29",
      // «1042025» → 10/4, i el `_0` final del nom no l'espatlla.
      "2025-04-10",
      // Aquest sí que porta separadors.
      "2025-04-30",
    ]);
  });
});

describe("dataCerdanyola", () => {
  it("llegeix les dues formes que hi ha a l'índex", () => {
    expect(dataCerdanyola("Acta … Juny 2025", "…plemunicipal2662025.pdf")).toBe("2025-06-26");
    expect(dataCerdanyola("Acta … Febrer 2025", "…plemunicipal2722025.pdf")).toBe("2025-02-27");
  });

  it("calla quan el mes del títol contradiu el del nom del fitxer", () => {
    // Si un dia el generador canvia de convenció, val més quedar-se sense data
    // que publicar una sessió amb la data d'un altre mes.
    expect(dataCerdanyola("Acta … Desembre 2025", "…plemunicipal2662025.pdf")).toBeNull();
  });

  it("calla quan no hi ha cua de dígits", () => {
    expect(dataCerdanyola("Acta … Gener 2025", "acta-ple.pdf")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rubí
// ─────────────────────────────────────────────────────────────────────────────

const HTML_RUBI = `
<a target="_blank" href="/documentPublic/download/5777"><img src="/images/fileicons/default.png" width="20" alt="Document" ><span class='pdfTitle'>4_Acta Ple 30.04.2026</span><span class="pdfSize">(Pdf, 294.22 Kb)</span></a>
<a target="_blank" href="/documentPublic/download/6094"><span class='pdfTitle'>06_Acta Ple extra ciutat 20.06.2026</span><span class="pdfSize">(Pdf, 234.51 Kb)</span></a>
<a target="_blank" href="/documentPublic/download/5510"><span class='pdfTitle'>Ordre del dia Ple 29.01.2026</span><span class="pdfSize">(Pdf, 90.00 Kb)</span></a>
<a href="/actesIacordsCategoriaPublic/listPublicacionsAmbCategoria?categoria.id=4&amp;offset=10&amp;max=10" class="step">2</a>
`;

describe("Rubí", () => {
  const documents = RUBI.extreu(HTML_RUBI, urlIndexRubi(1));

  it("resol els enllaços relatius contra el host de la seu", () => {
    expect(documents.map((d) => d.url)).toEqual([
      "https://seu.rubi.cat/documentPublic/download/5777",
      "https://seu.rubi.cat/documentPublic/download/6094",
    ]);
  });

  it("treu la data del text de l'enllaç i deixa fora l'ordre del dia", () => {
    expect(documents.map((d) => d.data)).toEqual(["2026-04-30", "2026-06-20"]);
    expect(documents.some((d) => d.titol.startsWith("Ordre"))).toBe(false);
  });

  it("pagina amb el camí que serveix el paginador, no amb el de la primera pàgina", () => {
    expect(urlIndexRubi(1)).toBe(
      "https://seu.rubi.cat/actesIacordsCategoriaPublic/cercadorCategoria/4",
    );
    expect(urlIndexRubi(3)).toBe(
      "https://seu.rubi.cat/actesIacordsCategoriaPublic/listPublicacionsAmbCategoria" +
        "?categoria.id=4&offset=20&max=10",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sant Cugat del Vallès
// ─────────────────────────────────────────────────────────────────────────────

const HTML_SANT_CUGAT = `
<a href="/files/651-24501-fitxer/Ple_Acta_20260309_Extra_MedallaOR_MC.pdf" target="_blank" class="pdf">Sessió extraordinària 9 de març de 2026<br/>
<span class="notranslate">PDF, 436.0 Kb</span></a>
<a href="/files/651-24498-fitxer/Ple_OrdreDia_20260327_Ordinari.pdf" target="_blank" class="pdf">Sessió ordinària 27 de març de 2026 - 9 h<br/><span class="notranslate">PDF, 7.1 Mb</span></a>
<a href="/files/651-12345-fitxer/Ple_ExtracteAcords_20180618.pdf" target="_blank" class="pdf">Sessió ordinària 18 de juny de 2018<br/><span class="notranslate">PDF, 120 Kb</span></a>
<a href="/files/651-24918-fitxer/07 PLE_24 07 2026.pdf" target="_blank" class="pdf">Sessió ordinària 24 de juliol de 2026<br/><span class="notranslate">PDF, 8.6 Mb</span></a>
<a href="/files/651-9999-fitxer/Codi_de_Conducta.pdf" class="pdf">Codi de conducta</a>
`;

describe("Sant Cugat del Vallès", () => {
  const documents = SANT_CUGAT.extreu(HTML_SANT_CUGAT, "https://santcugat.cat/web/el-ple");

  it("classifica la mena pel nom del fitxer, que és l'únic que ho diu", () => {
    expect(documents.map((d) => d.mena)).toEqual([
      "acta",
      "ordre_del_dia",
      "extracte_acords",
      "desconegut",
    ]);
  });

  it("diu «desconegut» en comptes d'endevinar", () => {
    // «07 PLE_24 07 2026.pdf» no declara què és; la columna de la taula sí, però
    // això no arriba a l'enllaç. Marcar-ho d'acta seria publicar un ordre del
    // dia com si fos el resultat d'una sessió.
    const ambigu = documents.find((d) => d.url.includes("07%20PLE"))!;
    expect(ambigu.mena).toBe("desconegut");
    expect(ambigu.data).toBe("2026-07-24");
  });

  it("treu la data del nom quan hi és i del títol en català quan no", () => {
    expect(documents.map((d) => d.data)).toEqual([
      "2026-03-09",
      "2026-03-27",
      "2018-06-18",
      "2026-07-24",
    ]);
  });

  it("no confon un document que no és de cap sessió", () => {
    expect(documents.some((d) => d.url.includes("Codi_de_Conducta"))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Vilanova i la Geltrú i Granollers
// ─────────────────────────────────────────────────────────────────────────────

const HTML_VILANOVA = `
<a href="/doc/doc_95726032.pdf" title="Sessió ordinària de 18 de gener de 2016">Sessió ordinària de 18 de gener de 2016</a>
<a href="/doc/doc_18039190.pdf" title="Sessió extraordinària de 4 d'abril de 2016 (Defensor)">Sessió extraordinària de 4 d'abril de 2016 (Defensor)</a>
<a href="https://link.wetown.es/vilanova-i-la-geltru?download=">Vilanova i la Geltrú APP</a>
`;

describe("Vilanova i la Geltrú", () => {
  const documents = VILANOVA.extreu(HTML_VILANOVA, "https://www.vilanova.cat/ajuntament/actes_del_ple");

  it("llegeix la data escrita en català, amb apòstrof i tot", () => {
    expect(documents.map((d) => d.data)).toEqual(["2016-01-18", "2016-04-04"]);
    expect(documents.every((d) => d.mena === "acta")).toBe(true);
  });

  it("no es queda cap enllaç que no sigui un document de sessió", () => {
    expect(documents.some((d) => d.url.includes("wetown"))).toBe(false);
  });
});

/** A Granollers el títol no és al text de l'enllaç: és a l'`alt` de la imatge. */
const HTML_GRANOLLERS = `
<a target="_new" href="RecursosWeb/DOCUMENTOS/1/0_3997_1.pdf" title="Acta de Ple extraordinari d'11 de juny de 2019" rel="nofollow"><img alt="Acta de Ple extraordinari d'11 de juny de 2019" title="Acta de Ple extraordinari d'11 de juny de 2019" src="resid/1/img/icodocumento.gif" /></a>
<a target="_new" href="RecursosWeb/DOCUMENTOS/1/0_3996_1.pdf" rel="nofollow"><img alt="Acta de Ple ordinari de 30 d'abril de 2019" src="resid/1/img/icodocumento.gif" /></a>
`;

describe("Granollers", () => {
  const base =
    "https://seuelectronica.granollers.cat/portal/sede/se_contenedor1.jsp" +
    "?seccion=s_ldoc_d11_v1.jsp&codbusqueda=49&language=ca&codResi=1&codMenuPN=20&codMenu=70";
  const documents = GRANOLLERS.extreu(HTML_GRANOLLERS, base);

  it("agafa el títol de l'alt de la imatge i en treu la data", () => {
    expect(documents.map((d) => `${d.mena} ${d.data}`)).toEqual([
      "acta 2019-06-11",
      "acta 2019-04-30",
    ]);
  });

  it("resol el camí relatiu contra el directori del JSP", () => {
    expect(documents[0]!.url).toBe(
      "https://seuelectronica.granollers.cat/portal/sede/RecursosWeb/DOCUMENTOS/1/0_3997_1.pdf",
    );
  });

  it("pagina amb numeroPagina i deixa la primera pàgina sense sufix", () => {
    const urls = GRANOLLERS.urlsIndex({ pagines: 3 });
    expect(urls[0]).toBe(base);
    expect(urls[2]).toBe(`${base}&numeroPagina=3`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gavà · l'única videoacta amb recompte
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retall de la fitxa del Ple ordinari del 18/06/2026. Cada punt hi surt dues
 * vegades: com a text («A favor: 11 En contra: 7 Abstenció: 3») i com a sèrie
 * del gràfic de sectors (`data-series="[11, 7, 3]"`). Llegim el gràfic i
 * comprovem amb el text, perquè el que ens pot matar no és llegir malament un
 * número sinó aparellar el recompte amb el punt equivocat.
 */
const HTML_GAVA = `
<div class="votingTopicDiv">
  <div class="topicTitle">3.-Aprovació de l'acta de la sessió anterior.-</div>
  <div>Resultat de la votació: <span>A favor</span></div>
  <div>Votació pública</div>
  <div class="cheeseChartVotes" data-series="[21, 0, 0]"></div>
  <div><span>A favor: 21</span><span>En contra: 0</span><span>Abstenció: 0</span></div>
</div>
<div class="votingTopicDiv">
  <div class="topicTitle">8.-Aprovació definitiva de la modificació de l'estudi de viabilitat econòmic financer.-</div>
  <div>Resultat de la votació: <span>A favor</span></div>
  <div>Votació pública</div>
  <div class="cheeseChartVotes" data-series="[11, 7, 3]"></div>
  <div><span>A favor: 11</span><span>En contra: 7</span><span>Abstenció: 3</span></div>
</div>
`;

describe("Gavà", () => {
  it("llegeix el recompte de cada punt i el lliga amb el títol", () => {
    const punts = votacionsGava(HTML_GAVA);
    expect(punts).toHaveLength(2);
    expect(punts[0]).toEqual({
      titol: "3.-Aprovació de l'acta de la sessió anterior.-",
      favor: 21,
      contra: 0,
      abstencio: 0,
      sistema: "Votació pública",
    });
    expect(punts[1]!.titol).toContain("viabilitat econòmic financer");
    expect([punts[1]!.favor, punts[1]!.contra, punts[1]!.abstencio]).toEqual([11, 7, 3]);
  });

  it("s'atura si el gràfic i el text no diuen el mateix", () => {
    // Un gràfic i un text descordats voldrien dir que la pàgina ha canviat de
    // forma. Publicar-ho seria atribuir a un punt el vot d'un altre.
    const trencat = HTML_GAVA.replace('data-series="[11, 7, 3]"', 'data-series="[7, 11, 3]"');
    expect(() => votacionsGava(trencat)).toThrow(PortalError);
  });

  it("s'atura si hi ha més gràfics que recomptes", () => {
    const trencat = `${HTML_GAVA}<div class="cheeseChartVotes" data-series="[1, 2, 3]"></div>`;
    expect(() => votacionsGava(trencat)).toThrow(PortalError);
  });

  it("llegeix els identificadors de sessió de la portada sense repetir-los", () => {
    const portada = `
      <a href="/session/sessionDetail/8a8180879ec8e4d3019eca35d9f0001d">Ple del 18 de juny</a>
      <a href="/session/sessionDetail/8a8180879ec8e4d3019eca35d9f0001d">Vídeo</a>
      <a href="/session/sessionDetail/8a8180879ec8e4d3019eca35d9f0002e">Ple del 21 de maig</a>
    `;
    expect(sessionsVideoacta(portada)).toEqual([
      "8a8180879ec8e4d3019eca35d9f0001d",
      "8a8180879ec8e4d3019eca35d9f0002e",
    ]);
  });

  it("no deixa construir una URL de sessió amb un identificador inventat", () => {
    expect(() => urlSessioGava("../../session/downloadItem/1")).toThrow(PortalError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Peces comunes
// ─────────────────────────────────────────────────────────────────────────────

describe("enllacos", () => {
  it("desfà les entitats de l'href i resol el camí relatiu", () => {
    const [e] = enllacos(
      '<a href="/llista?categoria.id=4&amp;offset=10">P&agrave;gina 2</a>',
      "https://seu.rubi.cat/actes",
    );
    expect(e!.href).toBe("https://seu.rubi.cat/llista?categoria.id=4&offset=10");
  });

  it("ignora les àncores i els enllaços buits", () => {
    expect(enllacos('<a href="#dalt">Amunt</a><a href="">Res</a>', "https://exemple.cat")).toEqual([]);
  });
});

describe("nomFitxer", () => {
  it("desfà els %20 dels noms amb espais", () => {
    expect(nomFitxer("https://santcugat.cat/files/651-24918-fitxer/07%20PLE_24%2007%202026.pdf")).toBe(
      "07 PLE_24 07 2026.pdf",
    );
  });
});

describe("dataCatalana", () => {
  it("aguanta les tres formes que fan servir aquests portals", () => {
    expect(dataCatalana("Sessió ordinària de 18 de gener de 2016")).toBe("2016-01-18");
    expect(dataCatalana("Acta de Ple extraordinari d'11 de juny de 2019")).toBe("2019-06-11");
    expect(dataCatalana("Sessió ordinària 24 de juliol de 2026")).toBe("2026-07-24");
  });

  it("no s'inventa res quan no hi ha data", () => {
    expect(dataCatalana("Acta de la sessió anterior")).toBeNull();
    expect(dataDdMmAa("Disposicio-SalodePlens-2023-2027.pdf")).toBeNull();
  });
});

describe("el registre", () => {
  it("té els set portals que funcionen, cadascun amb llicència i robots escrits", () => {
    expect(Object.keys(PORTALS).sort()).toEqual([
      "cerdanyola-del-valles",
      "girona",
      "granollers",
      "manresa",
      "rubi",
      "sant-cugat-del-valles",
      "vilanova-i-la-geltru",
    ]);
    for (const portal of Object.values(PORTALS)) {
      expect(portal.llicencia.length).toBeGreaterThan(40);
      expect(portal.robots.length).toBeGreaterThan(40);
      expect(portal.cobertura.length).toBeGreaterThan(20);
      expect(portal.urlsIndex().length).toBeGreaterThan(0);
    }
  });

  it("documenta amb un motiu cadascuna de les que no es poden fer", () => {
    expect(Object.keys(PORTALS_DESCARTATS)).toHaveLength(11);
    for (const motiu of Object.values(PORTALS_DESCARTATS)) {
      expect(motiu.length).toBeGreaterThan(80);
    }
    // Terrassa no és «no publica»: és «no ens hi deixa entrar un client HTTP».
    expect(PORTALS_DESCARTATS.terrassa).toContain("cf-mitigated");
  });

  it("no repeteix cap municipi entre els que funcionen i els descartats", () => {
    for (const slug of Object.keys(PORTALS)) {
      expect(PORTALS_DESCARTATS[slug]).toBeUndefined();
    }
  });
});
