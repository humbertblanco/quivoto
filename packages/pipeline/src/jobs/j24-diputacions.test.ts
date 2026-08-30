import { describe, expect, it } from "vitest";
import {
  columnesTaula,
  DIPUTATS_AL_CENS,
  eurosDeCella,
  motiuSenseImport,
  parseAltsCarrecsSeue,
  retribucioDeFitxa,
  SLUGS_DIPUTACIONS,
  URL_ALTS_CARRECS,
} from "./j24-diputacions";

/*
 * Tots els fragments d'aquest fitxer són retallats de les pàgines de debò,
 * descarregades el 30-08-2026. Un fixture inventat només comprova que el codi
 * fa el que el codi fa; aquests comproven que fa el que la font diu.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Els euros d'una cel·la
// ─────────────────────────────────────────────────────────────────────────────

describe("eurosDeCella", () => {
  /**
   * Les dues taules escriuen l'import diferent: Tarragona hi posa el símbol i
   * Girona no. Si el lector n'exigís, Girona hi donaria 27 imports buits i la
   * fitxa diria que cap diputat gironí cobra res.
   */
  it("llegeix l'import porti el símbol o no", () => {
    expect(eurosDeCella("93.810,42 €")).toBe(93_810.42);
    expect(eurosDeCella("91.526,82")).toBe(91_526.82);
    expect(eurosDeCella("52.775,24")).toBe(52_775.24);
  });

  /** El president de Lleida el té escrit amb punt de milers i punt decimal. */
  it("desfà el punt que fa de coma a la fitxa de Lleida", () => {
    expect(eurosDeCella("Retribució anual bruta: 82.081.76 €")).toBe(82_081.76);
  });

  /**
   * «No aplica», el guió i la cel·la buida volen dir que no hi ha xifra, no que
   * la xifra sigui zero. Un zero aquí diria que la presidenta d'una diputació
   * no cobra res, que és exactament el tipus d'error que exculpa.
   */
  it("una cel·la sense dígits no és cap zero", () => {
    expect(eurosDeCella("No aplica")).toBeNull();
    expect(eurosDeCella("-")).toBeNull();
    expect(eurosDeCella("")).toBeNull();
    expect(eurosDeCella("&nbsp;")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Les columnes, trobades pel títol
// ─────────────────────────────────────────────────────────────────────────────

const CAPCALERA_TARRAGONA = [
  "Relació de diputats",
  "Grup polític",
  "Govern / Oposició",
  "Relació de càrrecs",
  "Règim de dedicació",
  "Retribucions anuals brutes*",
  "Indemnització màxima bruta per assistències a òrgans",
];

const CAPCALERA_GIRONA = [
  "Nom",
  "Cognoms",
  "Càrrec",
  "Data de nomenament Diputat/da",
  "Dedicació",
  "Retribucions brutes anuals actualitzades",
  "Indemnització màxima per assistències a òrgans col·legiats actualitzades",
];

describe("columnesTaula", () => {
  it("entén la capçalera de Tarragona", () => {
    expect(columnesTaula(CAPCALERA_TARRAGONA)).toEqual({
      nom: 0,
      cognoms: -1,
      carrec: 3,
      dedicacio: 4,
      retribucio: 5,
      assistencies: 6,
    });
  });

  it("entén la de Girona, que parteix el nom en dues columnes", () => {
    expect(columnesTaula(CAPCALERA_GIRONA)).toEqual({
      nom: 0,
      cognoms: 1,
      carrec: 2,
      dedicacio: 4,
      retribucio: 5,
      assistencies: 6,
    });
  });

  /**
   * La columna d'indemnitzacions per assistència s'ha de reconèixer **abans**
   * que la de retribucions: totes dues parlen de diners i, si s'agafés la
   * primera que en parla, el sostre d'assistències acabaria publicat com si fos
   * el sou d'una persona sense dedicació.
   */
  it("no confon la indemnització per assistències amb una retribució", () => {
    const cols = columnesTaula(["Nom", "Indemnització per assistències", "Retribucions anuals brutes"]);
    expect(cols).toEqual({ nom: 0, cognoms: -1, carrec: -1, dedicacio: -1, retribucio: 2, assistencies: 1 });
  });

  it("no dona per bona una taula sense nom o sense import", () => {
    expect(columnesTaula(["Òrgan col·legiat", "Retribució bruta per assistència"])).toBeNull();
    expect(columnesTaula(["Nom", "Cognoms", "Càrrec"])).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La taula sencera
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Girona posa tres files de títol i de text abans de la capçalera de debò. Si
 * el lector suposés que la capçalera és la primera fila, aquesta taula donaria
 * zero diputats i la Diputació de Girona tornaria a semblar muda.
 */
const TAULA_GIRONA = `
<table>
  <tr><td>Cartipàs i retribucions dels càrrecs electes de la Diputació de Girona (última actualització 05-02-2026)</td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td></tr>
  <tr><td>Nom</td><td>Cognoms</td><td>Càrrec</td><td>Data de nomenament Diputat/da</td><td>Dedicació</td><td>Retribucions brutes anuals actualitzades</td><td>Indemnització màxima per assistències a òrgans col·legiats actualitzades</td></tr>
  <tr><td>Miquel</td><td>Noguer Planas</td><td>President</td><td>Sessió extraordinària Ple 27/07/2023</td><td>Exclusiva</td><td>91.526,82</td><td></td></tr>
  <tr><td>Maria</td><td>Puig Ferrer</td><td>Vicepresidenta tercera</td><td>Sessió extraordinària Ple 27/07/2023</td><td>Sense dedicació</td><td></td><td>64.622,74</td></tr>
</table>`;

const TAULA_TARRAGONA = `
<p>Mandat 2023-2027</p>
<table>
  <tr><th>Relació de diputats</th><th>Grup polític</th><th>Govern / Oposició</th><th>Relació de càrrecs</th><th>Règim de dedicació</th><th>Retribucions anuals brutes*</th><th>Indemnització màxima bruta per assistències a òrgans</th></tr>
  <tr><td>Noemí Llauradó i Sans</td><td>ERC</td><td>Govern</td><td>Presidenta</td><td>exclusiva</td><td>93.810,42 €</td><td>No aplica</td></tr>
  <tr><td>Fran Morancho López</td><td>PSC-CP</td><td>Govern</td><td>Vicepresident tercer</td><td>assistències</td><td>-</td><td>31.874,76 €</td></tr>
</table>
<table>
  <tr><th>Òrgan col·legiat</th><th>Retribució bruta per assistència</th></tr>
  <tr><td>Assistència al Ple</td><td>750,00 €</td></tr>
</table>`;

describe("parseAltsCarrecsSeue", () => {
  it("llegeix la taula de Girona i en recull la data que ella mateixa es posa", () => {
    const taula = parseAltsCarrecsSeue(TAULA_GIRONA);
    expect(taula.actualitzat).toBe("05-02-2026");
    expect(taula.diputats).toHaveLength(2);
    expect(taula.diputats[0]).toEqual({
      nom: "Miquel Noguer Planas",
      carrec: "President",
      dedicacio: "Exclusiva",
      retribucioAnualBruta: 91_526.82,
      maximPerAssistencies: null,
    });
  });

  /**
   * El cas que dona sentit a tenir dos camps: una vicepresidenta sense
   * dedicació **no cobra 64.622,74 €**; aquest número és el màxim que podria
   * arribar a cobrar en indemnitzacions si anés a totes les sessions. Posar-lo
   * al camp de retribució seria publicar un sou que no ha publicat ningú.
   */
  it("no converteix el sostre d'assistències en un sou", () => {
    const maria = parseAltsCarrecsSeue(TAULA_GIRONA).diputats[1]!;
    expect(maria.retribucioAnualBruta).toBeNull();
    expect(maria.maximPerAssistencies).toBe(64_622.74);
  });

  it("llegeix la taula de Tarragona, el mandat i el guió que vol dir res", () => {
    const taula = parseAltsCarrecsSeue(TAULA_TARRAGONA);
    expect(taula.mandat).toBe("2023-2027");
    expect(taula.diputats.map((d) => d.nom)).toEqual(["Noemí Llauradó i Sans", "Fran Morancho López"]);
    expect(taula.diputats[0]!.retribucioAnualBruta).toBe(93_810.42);
    expect(taula.diputats[0]!.maximPerAssistencies).toBeNull();
    expect(taula.diputats[1]!.retribucioAnualBruta).toBeNull();
    expect(taula.diputats[1]!.maximPerAssistencies).toBe(31_874.76);
  });

  /**
   * La segona taula de la pàgina de Tarragona és el preu per sessió, sense cap
   * nom de persona. Ha de quedar fora: «Assistència al Ple» no és ningú i
   * 750,00 € no és el sou de ningú.
   */
  it("descarta la taula de preus per sessió, que no té noms", () => {
    const noms = parseAltsCarrecsSeue(TAULA_TARRAGONA).diputats.map((d) => d.nom);
    expect(noms).not.toContain("Assistència al Ple");
  });

  it("una pàgina que ha canviat de forma no dona cap diputat inventat", () => {
    expect(parseAltsCarrecsSeue("<p>Pàgina en manteniment</p>").diputats).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La fitxa de Lleida
// ─────────────────────────────────────────────────────────────────────────────

/** Retall literal de la fitxa del president de la Diputació de Lleida. */
const FITXA_LLEIDA =
  '<p class="carrec-carrec">President</p>' +
  '<p class="carrec-retribucio"><strong>Retribució anual bruta:</strong> <span>82.081.76 €</span></p>' +
  '<p class="carrec-indemnitzacionsAnuals"><strong>Indemnitzacions anuals (Màxim):</strong> <span>0</span></p>';

describe("retribucioDeFitxa", () => {
  it("treu l'import del camp que publica la diputació que el paga", () => {
    expect(retribucioDeFitxa(FITXA_LLEIDA)).toBe(82_081.76);
  });

  it("sense el camp no s'hi inventa cap zero", () => {
    expect(retribucioDeFitxa('<p class="carrec-carrec">Diputat</p>')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// El motiu, quan no hi ha import
// ─────────────────────────────────────────────────────────────────────────────

describe("motiuSenseImport", () => {
  it("qui té import no té motiu", () => {
    expect(
      motiuSenseImport("Diputació de Girona", {
        nom: "Miquel Noguer Planas",
        carrec: "President",
        dedicacio: "Exclusiva",
        retribucioAnualBruta: 91_526.82,
        maximPerAssistencies: null,
      }),
    ).toBeNull();
  });

  it("distingeix «no en publica cap» de «no en paga cap»", () => {
    const senseDedicacio = motiuSenseImport("Diputació de Girona", {
      nom: "Maria Puig Ferrer",
      carrec: "Vicepresidenta tercera",
      dedicacio: "Sense dedicació",
      retribucioAnualBruta: null,
      maximPerAssistencies: 64_622.74,
    });
    expect(senseDedicacio).toContain("sostre");
    const senseRes = motiuSenseImport("Diputació de Barcelona", {
      nom: "Algú",
      carrec: "Diputat",
      dedicacio: null,
      retribucioAnualBruta: null,
      maximPerAssistencies: null,
    });
    expect(senseRes).toContain("no publica cap import anual");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Les constants comprovades contra la font
// ─────────────────────────────────────────────────────────────────────────────

describe("les quatre diputacions", () => {
  /**
   * Els slugs de seu-e no es dedueixen del nom: `dipta` i `ddgi` no s'assemblen
   * a «Diputació de Tarragona» ni a «Diputació de Girona». Aquesta prova hi és
   * perquè ningú no els «arregli» amb una regla generada, que és exactament el
   * que feia que dues diputacions no es trobessin.
   */
  it("porta els slugs reals, no els deduïts", () => {
    expect(SLUGS_DIPUTACIONS["Diputació de Tarragona"]).toBe("dipta");
    expect(SLUGS_DIPUTACIONS["Diputació de Girona"]).toBe("ddgi");
    expect(Object.keys(SLUGS_DIPUTACIONS)).toHaveLength(4);
  });

  /**
   * Les xifres són les del conjunt `nm3n-3vbj` de la Generalitat, comptades amb
   * un `group by nom_ens` el 30-08-2026. La prova les fixa una per una i no
   * només el total: si algú retoca la de Girona i compensa amb la de Lleida, el
   * total seguiria fent 130 i l'invariant no serviria de res.
   */
  it("el cens de la Generalitat en compta 130, i sap quants a cada casa", () => {
    expect(DIPUTATS_AL_CENS).toEqual({
      "Diputació de Barcelona": 51,
      "Diputació de Girona": 27,
      "Diputació de Lleida": 25,
      "Diputació de Tarragona": 27,
    });
    expect(Object.values(DIPUTATS_AL_CENS).reduce((a, b) => a + b, 0)).toBe(130);
  });

  /**
   * Totes quatre han de tenir cens i pàgina: una diputació amb slug però sense
   * invariant es llegiria sense que ningú comprovés si en surt el ple sencer.
   */
  it("cap diputació es queda sense invariant de recompte", () => {
    expect(Object.keys(DIPUTATS_AL_CENS).sort()).toEqual(Object.keys(SLUGS_DIPUTACIONS).sort());
  });

  it("les dues taules de seu-e tenen URL pròpia i acabada en el seu identificador", () => {
    expect(URL_ALTS_CARRECS["Diputació de Girona"]).toMatch(/ddgi\b.*retribucions-alts-carrecs-207$/);
    expect(URL_ALTS_CARRECS["Diputació de Tarragona"]).toMatch(/dipta\b.*retribucions-alts-carrecs-198$/);
  });
});
