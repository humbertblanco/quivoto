import { describe, expect, it } from "vitest";
import {
  COMPARACIONS,
  composaMostra,
  elsMesGrans,
  QUANTS_MUNICIPIS,
  type EntradaMostra,
  type MunicipiPla,
} from "./portada-mostra";

/**
 * La composició de la mostra amb deu municipis inventats i sense base de
 * dades. El que es comprova és que cada bloc digui el que diu la pàgina a què
 * porta: les marques comptades com a la pàgina de partit, el color de cada
 * alcaldia amb la regla del mapa, i qui té l'alcaldia amb la de la fitxa.
 */

function municipi(canvis: Partial<MunicipiPla> & { id: number; slug: string; name: string }): MunicipiPla {
  return { comarca: "Segrià", population: 2_000, mayorName: "Persona Qualsevol", mayorPartyRaw: "ERC-AM", ...canvis };
}

const MUNICIPIS: MunicipiPla[] = [
  municipi({ id: 1, slug: "barcelona", name: "Barcelona", comarca: "Barcelonès", population: 1_700_000, mayorName: "Jaume Collboni", mayorPartyRaw: "PSC-CP" }),
  municipi({ id: 2, slug: "l-hospitalet-de-llobregat", name: "L'Hospitalet de Llobregat", comarca: "Barcelonès", population: 280_000, mayorName: "David Quirós", mayorPartyRaw: "PSC-CP" }),
  // L'alcaldia és d'una llista que no lliga amb cap marca: grisa al mapa.
  municipi({ id: 3, slug: "girona", name: "Girona", comarca: "Gironès", population: 105_000, mayorName: "Lluc Salellas", mayorPartyRaw: "GUANYEM" }),
  // El cas de Tiana: el codi d'agrupació diu «local» i les sigles diuen Junts.
  municipi({ id: 4, slug: "tiana", name: "Tiana", comarca: "Maresme", population: 9_000, mayorName: "Isaac Salvatierra", mayorPartyRaw: "JUNTS" }),
  municipi({ id: 5, slug: "salt", name: "Salt", comarca: "Gironès", population: 33_000, mayorName: "Jordi Viñas", mayorPartyRaw: "ERC-AM" }),
  // Ni alcaldia ni sigles: ratllat al mapa.
  municipi({ id: 6, slug: "poble-buit", name: "Poble Buit", comarca: "Gironès", population: 500, mayorName: null, mayorPartyRaw: null }),
  municipi({ id: 7, slug: "alcarras", name: "Alcarràs" }),
  municipi({ id: 8, slug: "alpicat", name: "Alpicat" }),
  municipi({ id: 9, slug: "torrefarrera", name: "Torrefarrera" }),
  municipi({ id: 10, slug: "rossello", name: "Rosselló" }),
];

const llista = (
  id: number,
  municipalityId: number,
  sigles: string,
  brandId: string | null,
  seats: number,
  votes = seats * 100,
): EntradaMostra["llistes"][number] => ({ id, municipalityId, sigles, brandId, votes, seats });

function entrada(canvis: Partial<EntradaMostra> = {}): EntradaMostra {
  return {
    municipis: MUNICIPIS,
    // La mètrica de govern hi és a tots els municipis amb alcaldia; a dos
    // escriu el nom més llarg que la taula, que és el que passa de debò.
    govern: new Map<number, { mayorName: string | null; mayorSigles: string | null }>([
      ...MUNICIPIS.filter((m) => m.mayorName !== null).map(
        (m) => [m.id, { mayorName: m.mayorName, mayorSigles: m.mayorPartyRaw }] as const,
      ),
      [1, { mayorName: "Jaume Collboni Cuadrado", mayorSigles: "PSC-CP" }],
      [3, { mayorName: "Lluc Salellas i Vilar", mayorSigles: "GUANYEM" }],
    ]),
    llistes: [
      llista(1, 1, "PSC-CP", "psc", 10),
      llista(2, 1, "ERC-AM", "erc", 5),
      llista(3, 1, "JUNTS", "junts", 4),
      llista(4, 2, "PSC-CP", "psc", 12),
      llista(5, 3, "GUANYEM", "local", 10),
      llista(6, 3, "JUNTS", "junts", 6),
      llista(7, 4, "JUNTS", "local", 7),
      llista(8, 5, "ERC-AM", "erc", 9),
      llista(9, 7, "ERC-AM", "erc", 7),
      llista(10, 8, "ERC-AM", "erc", 7),
      llista(11, 9, "ERC-AM", "erc", 7),
      llista(12, 10, "ERC-AM", "erc", 7),
      // Una llista sense cap regidoria ni alcaldia no dona pàgina a la marca.
      llista(13, 1, "VOX", "vox", 0, 900),
    ],
    // El ple del registre electoral dels dos primers; Girona no en té, i la
    // seva alcaldia queda sense fitxa on enviar.
    registre: new Map([
      [1, [{ nom: "Jaume Collboni Cuadrado" }, { nom: "Laia Bonet Rull" }]],
      [2, [{ nom: "David Quirós" }, { nom: "Una Altra Persona" }]],
    ]),
    metropolitans: new Set([1, 2]),
    preguntes: [
      { slug: "girona", municipi: "Girona", jugable: false },
      { slug: "barcelona", municipi: "Barcelona", jugable: true },
      { slug: "alcarras", municipi: "Alcarràs", jugable: false },
    ],
    ...canvis,
  };
}

describe("composaMostra", () => {
  const mostra = composaMostra(entrada());

  it("compta les marques com la pàgina de partit: alcaldies i regidories, de més a menys", () => {
    expect(mostra.partits.map((p) => [p.id, p.alcaldies, p.regidories])).toEqual([
      ["erc", 5, 42],
      ["psc", 2, 22],
      ["junts", 1, 17],
    ]);
    // Vox va treure vots i cap regidoria: no té pàgina i no surt.
    expect(mostra.partits.some((p) => p.id === "vox")).toBe(false);
    expect(mostra.partits[0]).toMatchObject({ sigles: "ERC", nom: "Esquerra Republicana de Catalunya", color: "#ffb232" });
  });

  it("pinta cada alcaldia amb la regla del mapa: agrupació, sigles, i «local» quan cap de les dues", () => {
    const de = new Map(mostra.quiMana.map((q) => [q.slug, q.brandId]));
    expect(de.get("barcelona")).toBe("psc");
    // Tiana: el codi diu «local» i no és una negació; manen les sigles.
    expect(de.get("tiana")).toBe("junts");
    expect(de.get("girona")).toBe("local");
    expect(de.get("poble-buit")).toBeNull();
    expect(mostra.comptes).toEqual({
      municipis: 10,
      comarques: 4,
      alcaldiesAmbMarca: 8,
      alcaldiesLocals: 1,
      senseIdentificar: 1,
    });
  });

  it("ordena els 947 del mapa per slug, perquè el dibuix no depengui de l'ordre de la consulta", () => {
    const slugs = mostra.quiMana.map((q) => q.slug);
    expect(slugs).toEqual([...slugs].sort((a, b) => a.localeCompare(b)));
  });

  it("treu els més poblats amb el nom, la fitxa i les sigles de qui hi mana", () => {
    expect(mostra.municipis).toHaveLength(QUANTS_MUNICIPIS);
    expect(mostra.municipis.map((m) => m.slug).slice(0, 3)).toEqual(["barcelona", "l-hospitalet-de-llobregat", "girona"]);
    // Poble Buit és el desè per població: no hi surt.
    expect(mostra.municipis.some((m) => m.slug === "poble-buit")).toBe(false);

    const bcn = mostra.municipis[0]!;
    // El nom és el de la font oficial i la fitxa es troba al ple del registre.
    expect(bcn.alcaldia).toEqual({
      nom: "Jaume Collboni Cuadrado",
      sigles: "PSC-CP",
      brandId: "psc",
      adreca: "regidor/jaume-collboni-cuadrado/",
    });
    const lh = mostra.municipis[1]!;
    expect(lh.alcaldia).toMatchObject({ nom: "David Quirós", brandId: "psc" });
    expect(lh.alcaldia?.adreca).toMatch(/^regidor\/david-quiros/);
    // Girona: la llista no és de cap marca i, sense registre, no hi ha fitxa on enviar.
    expect(mostra.municipis[2]!.alcaldia).toEqual({
      nom: "Lluc Salellas i Vilar",
      sigles: "GUANYEM",
      brandId: null,
      adreca: null,
    });
  });

  it("suma les comarques dels mateixos municipis i diu qui hi mana més", () => {
    expect(mostra.comarques.map((c) => [c.slug, c.municipis, c.habitants])).toEqual([
      ["barcelones", 2, 1_980_000],
      ["girones", 3, 138_500],
      ["maresme", 1, 9_000],
      ["segria", 4, 8_000],
    ]);
    expect(mostra.comarques[0]!.forcaMes).toEqual({ brandId: "psc", sigles: "PSC", alcaldies: 2 });
    // Al Gironès mana ERC amb una: Girona és local i Poble Buit no se sap.
    expect(mostra.comarques[1]!.forcaMes).toEqual({ brandId: "erc", sigles: "ERC", alcaldies: 1 });
    expect(mostra.comarques[1]!.nom).toBe("Gironès");
  });

  it("posa primer les preguntes que ja es poden respondre, i després per nom", () => {
    expect(mostra.preguntes).toEqual([
      { slug: "barcelona", nom: "Barcelona", jugable: true },
      { slug: "alcarras", nom: "Alcarràs", jugable: false },
      { slug: "girona", nom: "Girona", jugable: false },
    ]);
  });

  it("copia les tres comparacions del comparador i hi posa els noms que sap", () => {
    expect(mostra.comparacions).toHaveLength(3);
    expect(COMPARACIONS.map((c) => c.slugs.join(","))).toEqual([
      "esplugues-de-llobregat,sant-just-desvern",
      "girona,lleida,tarragona",
      "olot,salt",
    ]);
    const capitals = mostra.comparacions[1]!;
    expect(capitals.noms).toEqual(["Girona", "lleida", "tarragona"]);
  });

  it("compta l'AMB només si algú hi és marcat", () => {
    expect(mostra.amb).toEqual({ municipis: 2, habitants: 1_980_000 });
    expect(composaMostra(entrada({ metropolitans: new Set() })).amb).toBeNull();
  });

  it("no peta amb una base buida", () => {
    const buida = composaMostra(entrada({ municipis: [], govern: new Map(), llistes: [], registre: new Map(), metropolitans: new Set(), preguntes: [] }));
    expect(buida.partits).toEqual([]);
    expect(buida.municipis).toEqual([]);
    expect(buida.comarques).toEqual([]);
    expect(buida.comptes.municipis).toBe(0);
  });
});

describe("elsMesGrans", () => {
  it("talla pels més poblats i desempata pel nom", () => {
    const tres = elsMesGrans(
      [
        { name: "B", population: 10 },
        { name: "A", population: 10 },
        { name: "C", population: 50 },
        { name: "D", population: null },
      ],
      3,
    );
    expect(tres.map((m) => m.name)).toEqual(["C", "A", "B"]);
  });
});
