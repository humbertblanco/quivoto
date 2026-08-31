import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCarrecs, titolMunicipi } from "../adapters/seue";
import {
  CONSELLS_SENSE_SEUE,
  creuaAmbInicials,
  dedicacioDeText,
  eurosDelText,
  llegeixFitxaConsell,
  nomsLliguenAmbInicials,
  SLUGS_CONSELLS,
} from "./j30-sous-consells";

/*
 * Els dos fixtures són HTML real retallat de seu-e, baixat el 31-08-2026: la
 * pàgina de càrrecs electes del Consell Comarcal del Baix Llobregat (el primer
 * grup i els tres primers càrrecs) i la fitxa de la seva presidenta. Les
 * cadenes soltes també són literals de fitxes reals, amb el consell d'on surt
 * cadascuna dit al costat. Un fixture inventat només comprova que el codi fa
 * el que el codi fa; aquests comproven que fa el que la font diu.
 */

const FIXTURES = join(__dirname, "..", "adapters", "__fixtures__");
const paginaConsell = readFileSync(join(FIXTURES, "consell-baixllobregat-carrecs.html"), "utf8");
const fitxaPresidenta = readFileSync(join(FIXTURES, "consell-baixllobregat-fitxa.html"), "utf8");

// ─────────────────────────────────────────────────────────────────────────────
// La pàgina del consell es llegeix amb el lector de seu-e de sempre
// ─────────────────────────────────────────────────────────────────────────────

describe("la pàgina de càrrecs electes d'un consell comarcal", () => {
  it("porta el nom de l'ens al títol, que és el que valida el slug", () => {
    expect(titolMunicipi(paginaConsell)).toBe("Consell Comarcal del Baix Llobregat");
  });

  /**
   * El nom que hi surt és «Eva M. Martínez Morales», amb la inicial: és
   * exactament la grafia que fa que el creuament exacte de la J14 la perdi.
   */
  it("dona la presidenta amb la seva fitxa, escrita amb la inicial", () => {
    const carrecs = parseCarrecs(paginaConsell);
    expect(carrecs.length).toBeGreaterThanOrEqual(3);
    const presidenta = carrecs[0]!;
    expect(presidenta.nom).toBe("Eva M. Martínez Morales");
    expect(presidenta.carrec).toBe("Presidenta");
    expect(presidenta.fitxa).toContain("veureCarrec/16910");
    // El p_auth caduca i el robots.txt de seu-e el prohibeix: no hi ha de ser.
    expect(presidenta.fitxa).not.toContain("p_auth");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La fitxa: l'import només quan és un import
// ─────────────────────────────────────────────────────────────────────────────

describe("llegeixFitxaConsell", () => {
  it("llegeix el que el Baix Llobregat publica de la seva presidenta", () => {
    const lectura = llegeixFitxaConsell("Consell Comarcal del Baix Llobregat", fitxaPresidenta);
    expect(lectura).toEqual({
      retribucioAnualBruta: 47_150,
      dedicacio: "dedicació exclusiva",
      // «No hi ha cap tipus d'indemnizació» no porta cap xifra: no és cap sostre.
      maximPerAssistencies: null,
      motiu: null,
    });
  });

  /**
   * El Maresme escriu preus per sessió dins del camp de retribució anual:
   * «Ple 200€ per sessió». Llegir-hi 200 € i desar-los com a sou anual diria
   * que la presidenta del Maresme cobra 200 € l'any, que és fals per totes
   * dues bandes. Text literal de la fitxa, baixada el 31-08-2026.
   */
  it("no converteix un preu per sessió en un sou anual", () => {
    const html =
      '<p class="carrec-retribucio"><strong>Retribució anual bruta:</strong> ' +
      "<span>Retribucions per assistència: Ple 200€ per sessió; Comissions Informatives 100€ per sessió; " +
      "Junta de Portaveus: 200€ per sessió (any 2026)</span></p>";
    const lectura = llegeixFitxaConsell("Consell Comarcal del Maresme", html);
    expect(lectura.retribucioAnualBruta).toBeNull();
    expect(lectura.motiu).toContain("per sessió");
  });

  /** El Tarragonès: «15.000 euros màxim anuals». Un sostre no és un sou. */
  it("no converteix un màxim en un sou", () => {
    const html =
      '<p class="carrec-retribucio"><strong>Retribució anual bruta:</strong> <span>15.000 euros màxim anuals</span></p>';
    const lectura = llegeixFitxaConsell("Consell Comarcal del Tarragonès", html);
    expect(lectura.retribucioAnualBruta).toBeNull();
    expect(lectura.motiu).toContain("sostre");
  });

  /**
   * L'Anoia no publica sou però sí el màxim d'indemnitzacions, amb l'any dins
   * del text: «l'any 2025 22.200 €». Va al camp de sostre, mai al de sou.
   */
  it("desa el màxim d'indemnitzacions com a sostre, no com a sou", () => {
    const html =
      '<p class="carrec-indemnitzacionsAnuals"><strong>Indemnitzacions anuals (Màxim):</strong> ' +
      "<span>l'any 2025 22.200 €</span></p>";
    const lectura = llegeixFitxaConsell("Consell Comarcal de l'Anoia", html);
    expect(lectura.retribucioAnualBruta).toBeNull();
    expect(lectura.maximPerAssistencies).toBe(22_200);
    expect(lectura.motiu).toContain("sostre");
  });

  it("una fitxa sense el camp no s'inventa cap zero", () => {
    const lectura = llegeixFitxaConsell("Consell Comarcal de l'Alt Camp", '<p class="carrec-carrec">President</p>');
    expect(lectura.retribucioAnualBruta).toBeNull();
    expect(lectura.maximPerAssistencies).toBeNull();
    expect(lectura.motiu).toContain("no publica cap import anual");
  });
});

describe("eurosDelText", () => {
  /**
   * El lector de números de la J14 admet espais dins del número —pels punts de
   * milers— i amb «l'any 2025 22.200 €» llegiria 202.522.200 €. L'any que no va
   * enganxat al símbol s'ha de treure abans.
   */
  it("no enganxa l'any amb l'import", () => {
    expect(eurosDelText("l'any 2025 22.200 €")).toBe(22_200);
    expect(eurosDelText("Any 2026 - 26.658,94€ bruts distribuïts en 14 pagues")).toBe(26_658.94);
  });

  it("un import que sembla un any es queda", () => {
    expect(eurosDelText("2020 €")).toBe(2_020);
  });

  it("sense símbol no hi ha import: «Retribució: 3» pot ser qualsevol cosa", () => {
    expect(eurosDelText("No hi ha cap tipus d'indemnizació")).toBeNull();
    expect(eurosDelText("")).toBeNull();
  });
});

describe("dedicacioDeText", () => {
  /** Les quatre maneres reals d'escriure-la, cadascuna del seu consell. */
  it("entén les grafies reals de les fitxes", () => {
    expect(dedicacioDeText("47.150,00 € bruts (dedicació exclusiva)")).toBe("dedicació exclusiva"); // Baix Llobregat
    expect(dedicacioDeText("31.944,30 € (50% de dedicació)")).toBe("50% de dedicació"); // Osona
    expect(dedicacioDeText("55.000 € al 100% jornada")).toBe("al 100% jornada"); // Segrià
    expect(
      dedicacioDeText("Any 2026 - 26.658,94€ bruts en règim de dedicació parcial del 40% de la jornada laboral"),
    ).toBe("dedicació parcial del 40%"); // Bages
  });

  it("sense dedicació escrita no se n'inventa cap", () => {
    expect(dedicacioDeText("15.000 euros màxim anuals")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// L'aparellament: exacte primer, i la inicial només quan és inequívoca
// ─────────────────────────────────────────────────────────────────────────────

describe("nomsLliguenAmbInicials", () => {
  /** El cas que va fer néixer la feina, amb les grafies literals de les fonts. */
  it("lliga la presidenta del Baix Llobregat amb l'alcaldessa de Vallirana", () => {
    expect(nomsLliguenAmbInicials("EVA MARÍA MARTÍNEZ MORALES (PSC-CP)", "Eva M. Martínez Morales")).toBe(true);
    expect(nomsLliguenAmbInicials("JOSÉ ANTONIO MONTEAGUDO URGEL", "JOSÉ A. MONTEAGUDO URGEL")).toBe(true);
  });

  /**
   * Els casos que la J24 va decidir no lligar i que aquí tampoc no lliguen: un
   * hipocorístic no és una inicial, i un cognom diferent és una altra persona.
   */
  it("no lliga hipocorístics ni cognoms diferents", () => {
    expect(nomsLliguenAmbInicials("FILOMENA CAÑETE CARRILLO", "Filo Cañete Carrillo")).toBe(false);
    expect(nomsLliguenAmbInicials("EVA MARÍA MARTÍNEZ MORALES", "Eva M. Martínez Puig")).toBe(false);
  });

  it("amb dos trossos no n'hi ha prou: massa fàcil encertar per atzar", () => {
    expect(nomsLliguenAmbInicials("MARIA PUIG", "M. Puig")).toBe(false);
  });

  it("la inicial ha de coincidir amb la lletra que abreuja", () => {
    expect(nomsLliguenAmbInicials("EVA ROSA MARTÍNEZ MORALES", "Eva M. Martínez Morales")).toBe(false);
  });
});

describe("creuaAmbInicials", () => {
  const municipals = [
    { nom: "EVA MARÍA MARTÍNEZ MORALES (PSC-CP)", codi: "vallirana" },
    { nom: "GEMMA RODRÍGUEZ QUIÑONERO", codi: "abrera" },
    { nom: "MARIA ROSA FONT VIDAL", codi: "poble-a" },
    { nom: "MONTSERRAT ROVIRA FONT VIDAL", codi: "poble-b" },
  ];

  it("el camí exacte va primer i no gasta la inicial", () => {
    const creuament = creuaAmbInicials(municipals, [{ nom: "Gemma Rodríguez Quiñonero" }]);
    expect(creuament.lligams).toHaveLength(1);
    expect(creuament.lligams[0]!.perInicials).toBe(false);
    expect(creuament.lligams[0]!.municipal.codi).toBe("abrera");
  });

  it("la inicial lliga quan només pot ser una persona", () => {
    const creuament = creuaAmbInicials(municipals, [{ nom: "Eva M. Martínez Morales" }]);
    expect(creuament.lligams).toHaveLength(1);
    expect(creuament.lligams[0]!.perInicials).toBe(true);
    expect(creuament.lligams[0]!.municipal.codi).toBe("vallirana");
  });

  /**
   * «M. Rosa Font Vidal» podria ser la Maria de poble A; «Maria R. Font Vidal»
   * també. Però si tots dos consellers reclamen la mateixa regidora, un dels
   * dos s'equivocaria per força: cap dels dos no lliga.
   */
  it("dos consellers que reclamen el mateix regidor no lliguen cap", () => {
    const creuament = creuaAmbInicials(
      [{ nom: "MARIA ROSA FONT VIDAL", codi: "poble-a" }],
      [{ nom: "M. Rosa Font Vidal" }, { nom: "Maria R. Font Vidal" }],
    );
    expect(creuament.lligams).toHaveLength(0);
    expect(creuament.ambigus).toHaveLength(2);
  });

  it("un nom exacte repetit a dos plens municipals no s'atribueix", () => {
    const creuament = creuaAmbInicials(
      [
        { nom: "JOAN FERRER PUIG", codi: "poble-a" },
        { nom: "Joan Ferrer Puig", codi: "poble-b" },
      ],
      [{ nom: "Joan Ferrer Puig" }],
    );
    expect(creuament.lligams).toHaveLength(0);
    expect(creuament.ambigus).toEqual(["joan ferrer puig"]);
  });

  it("qui no lliga amb ningú queda sense parella, no mal atribuït", () => {
    const creuament = creuaAmbInicials(municipals, [{ nom: "Pere Soler Camps" }]);
    expect(creuament.lligams).toHaveLength(0);
    expect(creuament.senseParella).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Les constants comprovades contra la font
// ─────────────────────────────────────────────────────────────────────────────

describe("els consells comarcals", () => {
  /**
   * 37 amb pàgina comprovada i 3 sense, que fan els 40 del cens de plens de la
   * Generalitat (`nm3n-3vbj`, comptats amb un group by el 31-08-2026). El del
   * Barcelonès no hi és perquè es va dissoldre el 2019, i l'Aran té el Conselh
   * Generau, que no és cap consell comarcal.
   */
  it("entre els comprovats i els absents hi són tots 40, sense repetir-ne cap", () => {
    const ambSlug = Object.keys(SLUGS_CONSELLS);
    const sense = Object.keys(CONSELLS_SENSE_SEUE);
    expect(ambSlug).toHaveLength(37);
    expect(sense).toHaveLength(3);
    expect(ambSlug.filter((ens) => sense.includes(ens))).toEqual([]);
    for (const ens of [...ambSlug, ...sense]) expect(ens).toMatch(/^Consell Comarcal/);
  });

  /**
   * Uns quants slugs reals, fixats perquè ningú no els «arregli» amb una regla
   * generada: la regla «cc + comarca» sense accents els encerta gairebé tots,
   * però la J24 ja va aprendre que gairebé no és una política.
   */
  it("porta els slugs comprovats, no deduïts", () => {
    expect(SLUGS_CONSELLS["Consell Comarcal del Baix Llobregat"]).toBe("ccbaixllobregat");
    expect(SLUGS_CONSELLS["Consell Comarcal d'Osona"]).toBe("ccosona");
    expect(SLUGS_CONSELLS["Consell Comarcal del Pla de l'Estany"]).toBe("ccpladelestany");
    expect(SLUGS_CONSELLS["Consell Comarcal de la Ribera d'Ebre"]).toBe("ccriberadebre");
  });

  it("els tres absents duen el motiu escrit, no un buit", () => {
    for (const motiu of Object.values(CONSELLS_SENSE_SEUE)) {
      expect(motiu.length).toBeGreaterThan(20);
    }
    expect(CONSELLS_SENSE_SEUE["Consell Comarcal del Baix Ebre"]).toContain("inici de sessió");
  });
});
