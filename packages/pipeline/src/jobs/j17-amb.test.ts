import { describe, expect, it } from "vitest";
import {
  CODI_AMB,
  MATERIES_AMB,
  MUNICIPIS_AMB,
  altresEntitats,
  codiEns10,
  municipisDeLAmb,
  type FilaParticipacio,
} from "./j17-amb";

/**
 * El que s'ha de provar d'aquesta feina no és que sàpiga baixar un JSON, sinó
 * que **compti bé**: tot el que la pàgina de l'AMB dirà —«els 36 municipis»—
 * penja d'aquesta llista, i una fila mal filtrada hi ficaria un municipi que no
 * hi és o en trauria un que sí.
 */

/** Una fila del conjunt tal com arriba de la Generalitat. */
function fila(over: Partial<FilaParticipacio> = {}): FilaParticipacio {
  return {
    codi_ens_pare: "0807340003",
    nom_ens_pare: "Ajuntament de Cornellà de Llobregat",
    descripcio_tipus_pare: "Municipis",
    codi_ens_on_participa: CODI_AMB,
    nom_ens_on_participa: "Àrea Metropolitana de Barcelona",
    ...over,
  };
}

describe("codiEns10", () => {
  it("torna el zero inicial que perden els codis de Barcelona", () => {
    // Tal com arriba d'una font que ha passat per un full de càlcul.
    expect(codiEns10("801930008")).toBe("0801930008");
    expect(codiEns10("0801930008")).toBe("0801930008");
  });

  it("no s'inventa un codi a partir del que no ho és", () => {
    // Si tornés qualsevol cosa acolorida de zeros, aparellaria per accident.
    expect(codiEns10("None")).toBe("");
    expect(codiEns10(null)).toBe("");
    expect(codiEns10("")).toBe("");
    expect(codiEns10("08019300081")).toBe("");
  });
});

describe("municipisDeLAmb", () => {
  it("es queda amb els municipis de l'AMB i prou", () => {
    expect(municipisDeLAmb([fila(), fila({ codi_ens_pare: "0801930008" })])).toEqual([
      "0801930008",
      "0807340003",
    ]);
  });

  it("no compta dos cops el mateix municipi", () => {
    // El registre pot repetir la relació; el recompte ha de ser de municipis.
    expect(municipisDeLAmb([fila(), fila()])).toHaveLength(1);
  });

  it("deixa fora una altra entitat metropolitana encara que sigui del mateix tipus", () => {
    // Aquest és el filtre que importa: si demà el Parlament en crea una segona,
    // sense això la llista es barrejaria en silenci i la pàgina diria que
    // Sabadell és a l'AMB.
    const files = [fila(), fila({ codi_ens_pare: "0818700007", codi_ens_on_participa: "8299990001" })];
    expect(municipisDeLAmb(files)).toEqual(["0807340003"]);
  });

  it("deixa fora el que participa a l'AMB sense ser un municipi", () => {
    const files = [fila(), fila({ codi_ens_pare: "0899999999", descripcio_tipus_pare: "Consorcis" })];
    expect(municipisDeLAmb(files)).toEqual(["0807340003"]);
  });

  it("no es queda sense res si la font no diu de quin tipus és l'ens pare", () => {
    // El camp és opcional al conjunt: si un dia arriba buit, el filtre no pot
    // buidar la llista sencera i deixar l'AMB sense municipis.
    expect(municipisDeLAmb([fila({ descripcio_tipus_pare: null })])).toEqual(["0807340003"]);
  });
});

describe("altresEntitats", () => {
  it("no en veu cap quan totes les files són de l'AMB", () => {
    expect(altresEntitats([fila(), fila({ codi_ens_pare: "0801930008" })])).toEqual([]);
  });

  it("assenyala amb nom i codi qualsevol altra entitat metropolitana", () => {
    const altres = altresEntitats([
      fila(),
      fila({ codi_ens_on_participa: "8299990001", nom_ens_on_participa: "Una altra àrea" }),
    ]);
    expect(altres).toEqual(["8299990001 · Una altra àrea"]);
  });
});

describe("les constants que la pàgina publicarà", () => {
  it("manté els 36 municipis de l'article 2 de la Llei 31/2010", () => {
    // No és una xifra d'estil: és la que decideix si la ingesta desa o s'atura.
    expect(MUNICIPIS_AMB).toBe(36);
  });

  it("anomena les vuit matèries de l'article 14, de la A a la H", () => {
    expect(MATERIES_AMB).toHaveLength(8);
    expect(MATERIES_AMB).toContain("transport i mobilitat");
    expect(MATERIES_AMB).toContain("aigües");
    expect(MATERIES_AMB).toContain("residus");
  });
});
