import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KIND,
  MUNICIPALS,
  construeixEleccio,
  fitxaLlistesObertes,
  membresDelZip,
  nomFitxer,
  nomZip,
  nomsPerPapereta,
  parseCandidats12,
  parseCandidatures03,
  parseMunicipis11,
  separaSuplent,
  urlZip,
  zipDeLaMunicipal,
} from "./j37-llistes-obertes";

/**
 * Línies reals dels fitxers del 2019 (`04201905_MUNI.zip`), retallades a
 * tres municipis: Sant Jaume de Frontanyà (08216, tres regidories), Gisclareny
 * (08093, consell obert: una) i Alcudia de Monteagud (04068, Almeria), que hi
 * és per comprovar que el filtre de províncies el deixa fora.
 */
const FIXTURES = join(__dirname, "..", "adapters", "__fixtures__", "infoelectoral");
const llegeix = (nom: string): string => readFileSync(join(FIXTURES, nom), "latin1");
const E2019 = MUNICIPALS.find((e) => e.any === 2019)!;

describe("noms de fitxer", () => {
  it("segueixen la convenció del Ministeri", () => {
    expect(nomZip(E2019)).toBe("04201905_MUNI.zip");
    expect(urlZip(E2019)).toBe("https://infoelectoral.interior.gob.es/estaticos/docxl/apliextr/04201905_MUNI.zip");
    expect(nomFitxer("12", E2019)).toBe("12041905.DAT");
    expect(nomFitxer("03", MUNICIPALS[0]!)).toBe("03047904.DAT");
    expect(MUNICIPALS).toHaveLength(12);
    expect(KIND).toBe("llistesObertes");
  });
});

describe("parseCandidats12", () => {
  const lectura = parseCandidats12(llegeix("12041905.DAT"), 2019);

  it("es queda les files catalanes i compta les altres", () => {
    expect(lectura.files).toHaveLength(7);
    expect(lectura.altres).toBe(10);
    expect(lectura.estranyes).toBe(0);
  });

  it("llegeix Sant Jaume de Frontanyà camp a camp", () => {
    const lluisa = lectura.files.find((f) => f.cognom1 === "VILALTA")!;
    expect(lluisa).toEqual({
      ine5: "08216", candidatura: "003378", votsCandidatura: 5, esconsCandidatura: 1,
      nom: "LLUÏSA", cognom1: "VILALTA", cognom2: "PÉREZ", sexe: "F", vots: 6, elegit: true,
    });
    const roc = lectura.files.find((f) => f.cognom1 === "CARRION")!;
    expect(roc.vots).toBe(0);
    expect(roc.elegit).toBe(false);
  });

  it("descarta les línies que no fan 123 caràcters o no són de l'any", () => {
    const text = `${llegeix("12041905.DAT")}\nuna línia que no és res\n`;
    expect(parseCandidats12(text, 2019).estranyes).toBe(1);
    expect(parseCandidats12(llegeix("12041905.DAT"), 2023).estranyes).toBe(17);
  });
});

describe("parseMunicipis11 i parseCandidatures03", () => {
  it("llegeix el cens, els vots i les regidories del fitxer 11", () => {
    const munis = parseMunicipis11(llegeix("11041905.DAT"), 2019);
    expect([...munis.keys()].sort()).toEqual(["08093", "08216"]);
    expect(munis.get("08216")).toEqual({ ine5: "08216", poblacio: 30, electors: 26, blancs: 0, nuls: 0, aCandidatures: 21, regidors: 3 });
    expect(munis.get("08093")!.regidors).toBe(1);
  });

  it("llegeix sigles i denominació del fitxer 03", () => {
    const candidatures = parseCandidatures03(llegeix("03041905.DAT"));
    expect(candidatures.get("003355")).toEqual({ sigles: "CxSJF-CP", nom: "COMPROMÍS PER SANT JAUME DE FRONTANYÀ-CANDIDATURA DE PROGRÉS" });
    expect(candidatures.get("006649")!.sigles).toBe("ERC-AM");
  });
});

describe("construeixEleccio", () => {
  const files = parseCandidats12(llegeix("12041905.DAT"), 2019).files;
  const munis = parseMunicipis11(llegeix("11041905.DAT"), 2019);
  const candidatures = parseCandidatures03(llegeix("03041905.DAT"));
  const sjf = construeixEleccio(E2019, files.filter((f) => f.ine5 === "08216"), munis.get("08216"), candidatures);

  it("ordena de més a menys vots, amb els noms llegibles i les sigles", () => {
    expect(sjf.candidats.map((c) => [c.nom, c.candidatura.sigles, c.vots, c.elegit])).toEqual([
      ["Manel Anselmo Amador", "CxSJF-CP", 12, true],
      ["Nil Anselmo Serres", "CxSJF-CP", 12, true],
      ["Lluïsa Vilalta Pérez", "SJF-AMUNT", 6, true],
      ["Anna Rosa Sanromà Cortina", "SJF-AMUNT", 5, false],
      ["Jordi Codina Ventura", "SJA-AM", 4, false],
      ["Roc Carrion Roig", "SJF-AMUNT", 0, false],
    ]);
    expect(sjf.candidats[2]!.clau).toBe("lluisa vilalta perez");
    expect(sjf.candidats[2]!.sexe).toBe("D");
  });

  it("porta les regidories, el cens i els votants del fitxer 11", () => {
    expect(sjf).toMatchObject({ any: 2019, data: "2019-05-26", regidors: 3, nomsPerPapereta: 2, electors: 26, votants: 21, blancs: 0, nuls: 0 });
  });

  it("sense fitxer 11 compta els elegits com a regidories i deixa el cens en blanc", () => {
    const sense = construeixEleccio(E2019, files.filter((f) => f.ine5 === "08216"), undefined, candidatures);
    expect(sense.regidors).toBe(3);
    expect(sense.electors).toBeNull();
    expect(sense.votants).toBeNull();
  });

  it("en consell obert s'elegeix un sol nom", () => {
    const gisclareny = construeixEleccio(E2019, files.filter((f) => f.ine5 === "08093"), munis.get("08093"), candidatures);
    expect(gisclareny.regidors).toBe(1);
    expect(gisclareny.nomsPerPapereta).toBe(1);
    expect(gisclareny.candidats).toEqual([
      { nom: "Joan Tor Tomas", clau: "joan tor tomas", sexe: "H", candidatura: { codi: "006649", sigles: "ERC-AM", nom: "ESQUERRA REPUBLICANA DE CATALUNYA-ACORD MUNICIPAL" }, vots: 20, elegit: true, suplent: false },
    ]);
  });

  it("desfà la marca de suplent del 1979 i tradueix regidories a noms per papereta", () => {
    expect(separaSuplent("Llordes (Suplente)")).toEqual({ cognom: "Llordes", suplent: true });
    expect(separaSuplent("Llordes")).toEqual({ cognom: "Llordes", suplent: false });
    expect(nomsPerPapereta(5)).toBe(4);
    expect(nomsPerPapereta(3)).toBe(2);
    expect(nomsPerPapereta(7)).toBeNull();
  });

  it("la fitxa ordena les eleccions cronològicament i porta la font", () => {
    const fitxa = fitxaLlistesObertes("08216", [sjf, { ...sjf, any: 2015, data: "2015-05-24" }], [urlZip(E2019)], "2026-09-03");
    expect(fitxa.eleccions.map((e) => e.any)).toEqual([2015, 2019]);
    expect(fitxa.font.organisme).toBe("Ministeri de l'Interior");
    expect(fitxa.font.consultat).toBe("2026-09-03");
    expect(fitxa.ine5).toBe("08216");
  });
});

describe("el zip", () => {
  it("es llegeix amb python i només en surten els fitxers 03, 11 i 12", async () => {
    const membres = await membresDelZip(join(FIXTURES, "04201905_MUNI-mostra.zip"));
    expect([...membres.keys()].sort()).toEqual(["03041905.DAT", "11041905.DAT", "12041905.DAT"]);
    expect(membres.get("12041905.DAT")).toContain("LLUÏSA");
  });

  it("no es torna a baixar si ja és al disc, i es baixa si no hi és", async () => {
    const dir = await mkdtemp(join(tmpdir(), "quivoto-j37-"));
    try {
      const crides: string[] = [];
      const baixa = async (url: string): Promise<Uint8Array> => {
        crides.push(url);
        return new Uint8Array(readFileSync(join(FIXTURES, "04201905_MUNI-mostra.zip")));
      };
      const primer = await zipDeLaMunicipal(E2019, baixa, dir);
      expect(primer).toEqual({ ruta: join(dir, "04201905_MUNI.zip"), baixat: true });
      expect(crides).toEqual([urlZip(E2019)]);
      const segon = await zipDeLaMunicipal(E2019, baixa, dir);
      expect(segon.baixat).toBe(false);
      expect(crides).toHaveLength(1);
      await writeFile(join(dir, "04201505_MUNI.zip"), "");
      const buit = await zipDeLaMunicipal(MUNICIPALS.find((e) => e.any === 2015)!, baixa, dir);
      expect(buit.baixat).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
