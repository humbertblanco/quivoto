import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseJsonStat, type CelaJsonStat } from "../adapters/idescat";
import { buildPeerGroups } from "../derive/peers";
import { variacioEntre, type PuntSerie } from "./j9-habitatge-residus";
import { medianaPerGrup, partDelTotal } from "./j15-despesa-serveis";
import {
  FONTS_DESCARTADES,
  INDICADORS,
  LLINDAR_PADRO_CENS,
  creuament,
  divergencia,
  padroContraCens,
  sumaExacta,
} from "./j18-poblacio";

/**
 * Les xifres d'aquestes proves surten de respostes reals de l'Idescat, i les de
 * Sabadell són les que fan que aquest fitxer existeixi: 34.062 persones de
 * nacionalitat estrangera i 46.870 nascudes a l'estranger, el mateix any i el
 * mateix poble.
 */
const fixture = (nom: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, "..", "adapters", "__fixtures__", nom), "utf8"));

const nacionalitat = parseJsonStat(fixture("idescat-nacionalitat.json"));
const llocNaixement = parseJsonStat(fixture("idescat-lloc-naixement.json"));

const valor = (
  taula: { celes: CelaJsonStat[] },
  mun: string,
  any: number,
  categories: Record<string, string>,
): number | null =>
  taula.celes.find(
    (c) =>
      c.mun === mun &&
      c.any === any &&
      Object.entries(categories).every(([dim, id]) => c.categories[dim] === id),
  )?.valor ?? null;

const SABADELL = "081878";

describe("sumaExacta", () => {
  it("suma els trams d'edat que demana la fitxa", () => {
    // Infants de 0, 1 i 2 anys: la població de les llars d'infants.
    expect(sumaExacta([1_800, 1_850, 1_910])).toBe(5_560);
  });

  /**
   * Als pobles petits els trams de molt grans poden venir marcats com a
   * confidencials. Sumar només els que es publiquen donaria una xifra més baixa
   * que la real, i ningú no sabria que hi falta una part.
   */
  it("no suma a mitges: si en falta un tram, no hi ha xifra", () => {
    expect(sumaExacta([12, null, 3])).toBeNull();
    expect(sumaExacta([])).toBeNull();
  });

  it("zero és zero i no és cap forat", () => {
    expect(sumaExacta([0, 0, 0])).toBe(0);
  });
});

/**
 * La prova que ha de saltar si algú barreja les dues definicions.
 */
describe("nacionalitat i lloc de naixement no es barregen mai", () => {
  const estrangera = valor(nacionalitat, SABADELL, 2025, { NATION: "ESTR" })!;
  const nascutsFora = valor(llocNaixement, SABADELL, 2025, { PBIRTH: "ESTR" })!;
  const poblacio = valor(nacionalitat, SABADELL, 2025, { NATION: "TOTAL" })!;

  it("dona els dos percentatges que la fitxa ha de publicar, tots dos", () => {
    // 15,2 % de nacionalitat estrangera i 20,9 % de nascuts a l'estranger.
    expect(partDelTotal(estrangera, poblacio)).toBe(15.2);
    expect(partDelTotal(nascutsFora, poblacio)).toBe(20.9);
  });

  it("posa la diferència com el que és: persones, no un col·lectiu", () => {
    const resultat = divergencia(2025, poblacio, estrangera, nascutsFora)!;
    expect(resultat.nacionalitatEstrangera).toBe(34_062);
    expect(resultat.nascutsAEstranger).toBe(46_870);
    expect(resultat.persones).toBe(12_808);
    expect(resultat.mesGran).toBe("lloc de naixement");
  });

  /**
   * El nucli d'aquesta feina. Si algun dia algú afegeix aquí una xifra que sumi
   * o resti les dues definicions —«població d'origen estranger», «immigrants»—
   * aquesta prova ha de fallar abans que la fitxa arribi a cap poble.
   */
  it("no en surt cap tercera xifra que barregi definicions", () => {
    const resultat = divergencia(2025, poblacio, estrangera, nascutsFora)!;
    const claus = Object.keys(resultat);
    expect(claus).toEqual([
      "any",
      "poblacio",
      "nacionalitatEstrangera",
      "nascutsAEstranger",
      "pctNacionalitatEstrangera",
      "pctNascutsAEstranger",
      "persones",
      "mesGran",
      "nota",
    ]);
    const text = JSON.stringify(resultat).toLowerCase();
    for (const paraula of ["immigra", "origen estranger", "d'origen"]) {
      expect(text).not.toContain(paraula);
    }
  });

  it("no diu res si li falta cap de les dues xifres", () => {
    expect(divergencia(2025, poblacio, null, nascutsFora)).toBeNull();
    expect(divergencia(2025, null, estrangera, nascutsFora)).toBeNull();
  });

  it("cap indicador publicat no barreja les dues taules", () => {
    const perNacionalitat = INDICADORS.filter((i) => i.clau.toLowerCase().includes("nacionalitat"));
    const perNaixement = INDICADORS.filter((i) => i.clau.toLowerCase().includes("nascuts"));
    expect(perNacionalitat.every((i) => i.taula === "censph/5992/5987")).toBe(true);
    expect(perNaixement.every((i) => i.taula === "censph/293/296")).toBe(true);
    // I cap indicador no es diu ni descriu com una barreja dels dos.
    const text = JSON.stringify(INDICADORS).toLowerCase();
    expect(text).not.toContain("immigrant");
    expect(text).not.toContain("població d'origen");
  });

  it("cada indicador diu què compta, i els dos confusables ho diuen explícit", () => {
    for (const indicador of INDICADORS) expect(indicador.compta.length).toBeGreaterThan(30);
    expect(INDICADORS.find((i) => i.clau === "nacionalitatEstrangera")!.compta).toContain("NO és el mateix");
    expect(INDICADORS.find((i) => i.clau === "nascutsAEstranger")!.compta).toContain("NO és el mateix");
  });

  it("no hi ha dos indicadors amb la mateixa clau", () => {
    const claus = INDICADORS.map((i) => i.clau);
    expect(new Set(claus).size).toBe(claus.length);
  });
});

describe("creuament", () => {
  /**
   * Sabadell 2025, comprovat contra la taula creuada de l'Idescat: 15.780
   * persones nascudes fora d'Espanya amb nacionalitat espanyola i 2.970
   * estrangers nascuts aquí. Les dues xifres expliquen, juntes, les 12.808
   * persones de diferència entre els dos recomptes.
   */
  const sabadell = creuament({
    any: 2025,
    espanyolaTotal: 190_527,
    espanyolaNascudaAEspanya: 174_747,
    estrangeraNascudaAEspanya: 2_970,
    estrangeraTotalCreuada: 34_059,
    estrangeraTotalPrincipal: 34_062,
  });

  it("dona les dues xifres que expliquen la divergència", () => {
    expect(sabadell.nascutsForaAmbNacionalitatEspanyola).toBe(15_780);
    expect(sabadell.estrangersNascutsAEspanya).toBe(2_970);
  });

  /**
   * La taula creuada està arrodonida i el seu total d'estrangers no quadra amb
   * el de la taula principal. Es desa el desquadrament perquè la fitxa no pugui
   * presentar aquestes xifres com a exactes a la unitat.
   */
  it("no amaga que la font està arrodonida", () => {
    expect(sabadell.arrodonit).toBe(true);
    expect(sabadell.desquadrament).toBe(-3);
    expect(sabadell.nota).toContain("arrodonida");
  });

  it("no inventa res quan la taula no cobreix el municipi", () => {
    // L'Idescat només publica el creuament de 623 municipis dels 947.
    const buit = creuament({
      any: 2025,
      espanyolaTotal: null,
      espanyolaNascudaAEspanya: null,
      estrangeraNascudaAEspanya: null,
      estrangeraTotalCreuada: null,
      estrangeraTotalPrincipal: 162,
    });
    expect(buit.nascutsForaAmbNacionalitatEspanyola).toBeNull();
    expect(buit.estrangersNascutsAEspanya).toBeNull();
    expect(buit.desquadrament).toBeNull();
  });
});

describe("padroContraCens", () => {
  it("no crida l'atenció quan les dues xifres van juntes", () => {
    // Sabadell 2025: 225.368 empadronats i 224.589 censats. Un 0,3 %.
    const sabadell = padroContraCens(2025, 225_368, 224_589)!;
    expect(sabadell.percentual).toBe(0.3);
    expect(sabadell.persones).toBe(779);
    expect(sabadell.divergeix).toBe(false);
  });

  it("avisa quan el padró sobreregistra, com passa als municipis turístics", () => {
    // Un municipi amb un 2,5 % més d'empadronats que de censats.
    const turistic = padroContraCens(2025, 41_000, 40_000)!;
    expect(turistic.percentual).toBe(2.5);
    expect(turistic.percentual!).toBeGreaterThan(LLINDAR_PADRO_CENS);
    expect(turistic.divergeix).toBe(true);
  });

  it("no compara el que no té les dues xifres", () => {
    expect(padroContraCens(2025, null, 100)).toBeNull();
    expect(padroContraCens(2025, 100, null)).toBeNull();
    expect(padroContraCens(2025, 100, 0)).toBeNull();
  });
});

/**
 * La variació de mandat, i la del grup, que és la que la fa significar res.
 */
describe("la variació del mandat i la del grup", () => {
  /** Sabadell: la sèrie de població censada dels tres anys del fixture. */
  const censSabadell: PuntSerie[] = [2023, 2024, 2025].map((any) => ({
    any,
    valor: valor(nacionalitat, SABADELL, any, { NATION: "TOTAL" }),
  }));

  it("compara l'inici del mandat amb l'últim any, i diu quants anys cobreix", () => {
    const variacio = variacioEntre(censSabadell, 2023, 2025)!;
    expect(variacio.inici).toBe(217_968);
    expect(variacio.final).toBe(224_589);
    expect(variacio.diferencia).toBe(6_621);
    expect(variacio.percentual).toBe(3);
    expect(variacio.anys).toBe(2);
  });

  it("dona el pes de la població estrangera en punts percentuals, no en persones", () => {
    const pes: PuntSerie[] = [2023, 2025].map((any) => ({
      any,
      valor: partDelTotal(
        valor(nacionalitat, SABADELL, any, { NATION: "ESTR" }),
        valor(nacionalitat, SABADELL, any, { NATION: "TOTAL" }),
      ),
    }));
    const variacio = variacioEntre(pes, 2023, 2025)!;
    // Del 13,7 % al 15,2 %: un punt i mig, no dos mil persones.
    expect(variacio.inici).toBe(13.7);
    expect(variacio.final).toBe(15.2);
    expect(variacio.diferencia).toBe(1.5);
  });

  it("no compara un any que la font no publica", () => {
    // Les taules del cens comencen el 2021: no hi ha mandat anterior.
    expect(variacioEntre(censSabadell, 2019, 2023)).toBeNull();
  });

  it("no compta un municipi sense dades com si hagués perdut tota la població", () => {
    // Palmerola: l'Idescat la classifica i no en publica cap xifra.
    const palmerola: PuntSerie[] = [2023, 2025].map((any) => ({
      any,
      valor: valor(nacionalitat, "171220", any, { NATION: "TOTAL" }),
    }));
    expect(palmerola.every((p) => p.valor === null)).toBe(true);
    expect(variacioEntre(palmerola, 2023, 2025)).toBeNull();
  });

  /**
   * «Ha pujat un 3 %» no vol dir res sol. Aquesta prova és la comparació que
   * el converteix en informació: un municipi que puja el 3 % dins d'un grup que
   * puja el 6 % s'està quedant enrere, encara que la seva xifra sigui positiva.
   */
  it("posa la variació al costat de la del grup de la mateixa mida", () => {
    const municipis = [
      { id: 1, population: 220_000 },
      { id: 2, population: 210_000 },
      { id: 3, population: 260_000 },
      { id: 4, population: 300_000 },
      { id: 5, population: 150_000 },
    ];
    const grups = buildPeerGroups(municipis);
    // Tots cinc passen de 100.000 habitants: són el mateix grup.
    expect(new Set([...grups.values()].map((g) => g.key)).size).toBe(1);

    const variacions = new Map([
      [1, { fins: 2025, diferencia: 6_621, percentual: 3 }],
      [2, { fins: 2025, diferencia: 12_000, percentual: 6 }],
      [3, { fins: 2025, diferencia: 15_000, percentual: 6.5 }],
      [4, { fins: 2025, diferencia: 20_000, percentual: 7 }],
      [5, { fins: 2025, diferencia: 3_000, percentual: 2 }],
    ]);
    const delGrup = medianaPerGrup(variacions, grups);
    expect(delGrup.get(1)).toEqual({ fins: 2025, diferencia: 12_000, percentual: 6, municipis: 5 });
    // El municipi ha crescut, i tot i així ha crescut la meitat que els seus.
    expect(variacions.get(1)!.percentual).toBeLessThan(delGrup.get(1)!.percentual!);
  });

  it("no barreja variacions de períodes diferents dins del grup", () => {
    const grups = buildPeerGroups([
      { id: 1, population: 220_000 },
      { id: 2, population: 210_000 },
    ]);
    const variacions = new Map([
      [1, { fins: 2025, diferencia: 100, percentual: 3 }],
      [2, { fins: 2024, diferencia: 400, percentual: 9 }],
    ]);
    const delGrup = medianaPerGrup(variacions, grups);
    // Cadascun es compara amb qui té el mateix any final, encara que quedi sol.
    expect(delGrup.get(1)).toMatchObject({ fins: 2025, percentual: 3, municipis: 1 });
    expect(delGrup.get(2)).toMatchObject({ fins: 2024, percentual: 9, municipis: 1 });
  });
});

describe("les fonts que s'han descartat", () => {
  /**
   * Es proven perquè el motiu no es perdi: qualsevol que trobi aquests dos
   * conjunts al portal obert pensarà que ens hem descuidat una font de població
   * més fresca, i ha de trobar aquí per què no hi és.
   */
  it("deixa escrit per què el registre del CatSalut no serveix per comptar habitants", () => {
    const catsalut = FONTS_DESCARTADES.find((f) => f.origen.includes("7yq2-acdk"))!;
    expect(catsalut.motiu).toContain("613");
    expect(catsalut.motiu).toContain("Tiurana");
  });

  it("deixa escrit que les columnes per sexe del conjunt x5sz-niat són brossa", () => {
    const perSexe = FONTS_DESCARTADES.find((f) => f.origen.includes("x5sz-niat"))!;
    expect(perSexe.motiu).toContain("184.859");
  });

  it("cap indicador publicat no surt de cap de les dues", () => {
    const taules = new Set(INDICADORS.map((i) => i.taula));
    for (const font of FONTS_DESCARTADES) {
      for (const taula of taules) expect(font.origen).not.toContain(taula);
    }
    // Totes les taules que publiquem són de l'API de l'Idescat.
    for (const taula of taules) expect(taula).toMatch(/^(censph|pmh|phre)\/\d+\/\d+$/);
  });
});
