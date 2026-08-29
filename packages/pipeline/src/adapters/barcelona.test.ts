import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BarcelonaError,
  INE_BARCELONA,
  grupCanonic,
  llegeixCsv,
  parseMandat20192023,
  parseMandatActual,
  sentitVot,
} from "./barcelona";

/**
 * Els dos fixtures són retalls **literals** dels CSV oficials, triats perquè hi
 * caigui cada cas que trenca un lector ingenu:
 *
 *   mandat actual (7 línies) · capçalera + una fila neta + tres de mal escapades
 *     + la fila de tres referències de proposta + la votació nominal + una fila
 *     sense cap vot.
 *   mandat 2019-2023 (7 registres) · el rètol «sense filtres», la capçalera, i
 *     files amb salts de línia dins de les cometes, amb `absencia`, amb la
 *     votació nominal i amb el sentit escrit «A favor» en comptes de `a_favor`.
 */
const csvActual = readFileSync(
  join(__dirname, "__fixtures__", "barcelona-votacions-mandat-actual.csv"),
  "utf8",
);
const csv2019 = readFileSync(
  join(__dirname, "__fixtures__", "barcelona-votacions-2019-2023.csv"),
  "utf8",
);

describe("parseMandatActual", () => {
  const acords = parseMandatActual(csvActual);

  it("llegeix totes les files del retall", () => {
    expect(acords).toHaveLength(6);
    expect(acords.every((a) => a.municipiIne === INE_BARCELONA)).toBe(true);
    expect(acords.every((a) => a.mandat === "2023-2027")).toBe(true);
    expect(acords.every((a) => a.organ === "Consell Municipal")).toBe(true);
  });

  it("no perd els vots de les files mal escapades", () => {
    // Aquesta fila porta un `;` dins de `text`: amb un split posicional pel
    // davant, les columnes de vot quedarien desplaçades una posició.
    const declaracio = acords[0]!;
    expect(declaracio.titol).toContain("Rebutjar qualsevol tipus d'amnistia");
    expect(declaracio.text).toContain("així a la Junta de Govern de la FEMP.");
    expect(declaracio.resultat).toBe("rebutjat");
    expect(declaracio.votsGrup).toEqual([
      { grup: "Barcelona en Comú", etiqueta: "Barcelona en Comú", sentit: "en_contra" },
      {
        grup: "Partit dels Socialistes de Catalunya",
        etiqueta: "Partit dels Socialistes de Catalunya",
        sentit: "en_contra",
      },
      { grup: "Esquerra Republicana", etiqueta: "Esquerra Republicana", sentit: "en_contra" },
      { grup: "Partit Popular", etiqueta: "Partit Popular", sentit: "a_favor" },
      { grup: "VOX", etiqueta: "VOX Barcelona", sentit: "abstencio" },
      { grup: "Junts", etiqueta: "Junts per Catalunya", sentit: "en_contra" },
    ]);
  });

  it("aguanta la fila amb 91 camps sense desalinear-se", () => {
    // Les ordenances fiscals parteixen `text` en 30 trossos. Si l'ancoratge per
    // la dreta fallés, això es veuria de seguida en els vots.
    const ordenances = acords[1]!;
    expect(ordenances.titol).toBe(
      "Modificar provisionalment les ordenances fiscals per a l'exercici del 2024 i successius",
    );
    expect(ordenances.text).toContain("Impost sobre béns immobles");
    expect(ordenances.text).toContain("Impost sobre vehicles de tracció mecànica");
    expect(ordenances.votsGrup.map((v) => `${v.grup}=${v.sentit}`)).toEqual([
      "Barcelona en Comú=en_contra",
      "Partit dels Socialistes de Catalunya=a_favor",
      "Esquerra Republicana=en_contra",
      "Partit Popular=en_contra",
      "VOX=en_contra",
      "Junts=en_contra",
    ]);
  });

  it("recull les tres referències de la proposta acumulada", () => {
    // CP 13/25 vota tres expedients alhora i els separa amb `;` dins del camp:
    // per això la data, i no el recompte de camps, és l'àncora de l'esquerra.
    const multiple = acords.find((a) => a.refPropostes.length > 1)!;
    expect(multiple.refSessio).toBe("CP 13/25");
    expect(multiple.refPropostes).toEqual(["23XI0095", "23XI0105", "25XI0020"]);
    expect(multiple.data).toBe("2025-11-21");
  });

  it("normalitza les dates a ISO i les etiquetes de Junts", () => {
    expect(acords[0]!.data).toBe("2023-09-29");
    // La mateixa força política amb dos noms de columna dins d'un sol mandat.
    const etiquetes = acords.flatMap((a) => a.votsGrup).filter((v) => v.grup === "Junts");
    expect(new Set(etiquetes.map((v) => v.etiqueta))).toEqual(
      new Set(["Junts per Catalunya", "Junts per Barcelona"]),
    );
  });

  it("marca la part d'impuls i control, que és on hi ha les mocions", () => {
    expect(acords[0]!.partActa).toBe("D) Part d'impuls i control");
    expect(acords[0]!.esImpulsIControl).toBe(true);
    expect(acords[1]!.esImpulsIControl).toBe(false);
  });

  it("llegeix la votació nominal, l'única del mandat amb vot per regidor", () => {
    const nominal = acords.find((a) => a.sistemaVotacio === "nominal")!;
    expect(nominal.refSessio).toBe("CP 14/25 EXT");
    expect(nominal.votsRegidor).toHaveLength(41);
    expect(nominal.votsGrup).toHaveLength(0);
    expect(nominal.votsRegidor[0]).toEqual({
      nom: "Elisenda Alamany Gutiérrez",
      grup: "Esquerra Republicana",
      sentit: "a_favor",
    });
    // Una regidora hi consta com a absent («-»), no com a abstenció.
    expect(nominal.votsRegidor.filter((v) => v.sentit === "absent")).toEqual([
      { nom: "Janet Sanz Cid", grup: "Barcelona en Comú", sentit: "absent" },
    ]);
  });

  it("no inventa vots quan la font calla", () => {
    const senseVots = acords.find((a) => a.sistemaVotacio === "no_consta")!;
    expect(senseVots.votsGrup).toEqual([]);
    expect(senseVots.votsRegidor).toEqual([]);
    expect(senseVots.resultat).toBe("aprovat");
  });

  it("es queixa si la capçalera canvia, en comptes de llegir malament", () => {
    // Sense aquesta guarda, un canvi de columnes a l'origen entraria a la base
    // de dades com si res, amb els vots atribuïts al grup equivocat.
    const tocat = csvActual.replace("organ_resolucio", "organ");
    expect(() => parseMandatActual(tocat)).toThrow(BarcelonaError);
    expect(() => parseMandatActual(tocat)).toThrow(/capçalera inesperada/);
  });
});

describe("parseMandat20192023", () => {
  const acords = parseMandat20192023(csv2019);

  it("salta el rètol «sense filtres» i llegeix els registres", () => {
    expect(acords).toHaveLength(5);
    expect(acords.every((a) => a.mandat === "2019-2023")).toBe(true);
    // Aquest mandat publica el resum però no el text de l'acord.
    expect(acords.every((a) => a.text === null)).toBe(true);
  });

  it("no parteix els camps amb salts de línia a dins", () => {
    expect(acords[0]!.titol).toBe(
      "Nomenament de Joan Rodríguez Portell com a membre del Consell d'Administració de BSM",
    );
    expect(acords[0]!.resultat).toBe("aprovat_per_unanimitat");
    expect(acords[0]!.data).toBe("2022-06-23");
  });

  it("llegeix qui proposa i qui governa, que aquest mandat sí que ho diu", () => {
    expect(acords[0]!.proponent).toBe("Govern");
    expect(acords[0]!.equipGovern).toEqual([
      "Barcelona en Comú",
      "Partit dels Socialistes de Catalunya",
    ]);
  });

  it("unifica les sigles del mandat anterior amb les d'ara", () => {
    const rebutjat = acords.find((a) => a.resultat === "rebutjat")!;
    expect(rebutjat.votsGrup.map((v) => `${v.grup}=${v.sentit}`)).toEqual([
      "Esquerra Republicana=en_contra",
      "Barcelona en Comú=en_contra",
      "Partit dels Socialistes de Catalunya=abstencio",
      "Junts=a_favor",
      "Ciutadans=a_favor",
      "Partit Popular=a_favor",
      "Valents=a_favor",
    ]);
  });

  it("accepta les dues grafies de «a favor» que fa servir la font", () => {
    // 111 cel·les del fitxer duen «A favor» i 5.577 `a_favor`: el mateix vot.
    // A CP 5/23 conviuen les dues grafies dins d'una sola fila.
    const brut = acords.find((a) => a.refSessio === "CP 5/23")!;
    expect(brut.votsGrup.map((v) => `${v.etiqueta}=${v.sentit}`)).toEqual([
      "ERC=a_favor",
      "BComú=a_favor",
      "PSC=a_favor",
      "JxCat=a_favor",
      "Cs=abstencio",
      "PP=abstencio",
      "Valents=abstencio",
    ]);
  });

  it("distingeix absència d'abstenció", () => {
    const absencia = acords.flatMap((a) => a.votsGrup).filter((v) => v.sentit === "absent");
    expect(absencia.length).toBeGreaterThan(0);
  });
});

describe("llegeixCsv", () => {
  it("respecta cometes, cometes escapades i salts de línia", () => {
    expect(llegeixCsv('a;b\n"amb;punt";"diu ""hola""\nsegona"\n')).toEqual([
      ["a", "b"],
      ["amb;punt", 'diu "hola"\nsegona'],
    ]);
  });
});

describe("sentitVot i grupCanonic", () => {
  it("normalitza els valors que fan servir els dos fitxers", () => {
    expect(sentitVot("A favor")).toBe("a_favor");
    expect(sentitVot("a_favor")).toBe("a_favor");
    expect(sentitVot("En contra")).toBe("en_contra");
    expect(sentitVot("en_contra")).toBe("en_contra");
    expect(sentitVot("Abstenció")).toBe("abstencio");
    expect(sentitVot("abstencio")).toBe("abstencio");
    expect(sentitVot("absencia")).toBe("absent");
    expect(sentitVot("-")).toBe("absent");
    expect(sentitVot("")).toBe("no_consta");
  });

  it("crida si apareix un sentit nou, per no perdre'l en silenci", () => {
    expect(() => sentitVot("vot particular")).toThrow(BarcelonaError);
  });

  it("uneix els rebateigs de mig mandat", () => {
    expect(grupCanonic("Junts per Catalunya")).toBe("Junts");
    expect(grupCanonic("Junts per Barcelona")).toBe("Junts");
    expect(grupCanonic("JxCat")).toBe("Junts");
    expect(grupCanonic("BCN Canvi")).toBe("Valents");
    expect(grupCanonic("Valents")).toBe("Valents");
    expect(grupCanonic("BComú")).toBe("Barcelona en Comú");
  });
});
