import { describe, expect, it } from "vitest";
import {
  anysComplets, continuitatDe, indexPedersen, mateixaPersona, serieVolatilitat,
  volatilitatMitjana, votPerdutDe, type AnyElectoral, type PasAlcaldia,
} from "./trajectoria";

describe("indexPedersen", () => {
  it("dona el resultat calculat a mà", () => {
    // 20 regidors a cada elecció. PSC 10→8 (50 %→40 %), CiU 6 (30 %), ERC 4 (20 %)
    // i la CUP 0→2 (0 %→10 %). Suma de diferències: 10 + 0 + 0 + 10 = 20; meitat: 10.
    const anterior = { psc: 10, ciu: 6, erc: 4 };
    const actual = { psc: 8, ciu: 6, erc: 4, cup: 2 };
    expect(indexPedersen(anterior, actual)).toBe(10);
  });

  it("un ple calcat és zero i un relleu total és cent", () => {
    expect(indexPedersen({ psc: 7, erc: 4 }, { psc: 7, erc: 4 })).toBe(0);
    expect(indexPedersen({ psc: 11 }, { erc: 11 })).toBe(100);
  });

  it("normalitza per quota: créixer de ple no és volatilitat", () => {
    // El mateix repartiment a la meitat amb un ple que passa de 10 a 20 regidors.
    expect(indexPedersen({ psc: 5, erc: 5 }, { psc: 10, erc: 10 })).toBe(0);
  });

  it("no inventa un índex quan una de les dues eleccions no té escons", () => {
    expect(indexPedersen({}, { psc: 9 })).toBeNull();
  });
});

describe("serieVolatilitat", () => {
  const series: AnyElectoral[] = [
    { year: 2015, families: { psc: 10, ciu: 6, erc: 4 } },
    { year: 2019, families: { psc: 8, ciu: 6, erc: 4, cup: 2 } },
    { year: 2023, families: { psc: 8, ciu: 6, erc: 4, cup: 2 } },
  ];

  it("compara cada elecció amb l'anterior", () => {
    expect(serieVolatilitat(series).map((p) => [p.de, p.a, p.index])).toEqual([
      [2015, 2019, 10],
      [2019, 2023, 0],
    ]);
  });

  it("marca com a no fiable el tram dominat per llistes locals", () => {
    const locals: AnyElectoral[] = [
      { year: 2019, families: { local: 7, erc: 2 } },
      { year: 2023, families: { local: 7, erc: 2 } },
    ];
    // Dues llistes d'independents diferents hi surten com la mateixa força:
    // l'índex diria «zero volatilitat» sense saber-ne res.
    expect(serieVolatilitat(locals)[0]!.fiable).toBe(false);
    expect(volatilitatMitjana(serieVolatilitat(locals))).toBeNull();
  });

  it("la mitjana només compta els trams fiables", () => {
    expect(volatilitatMitjana(serieVolatilitat(series))).toBe(5);
  });
});

describe("continuitatDe", () => {
  // Historial fictici: la mateixa força governa des del 1995 sota tres noms
  // diferents, i abans hi havia CiU. Al 2023 hi ha relleu de persona.
  const historial: PasAlcaldia[] = [
    { legislatura: "1991-1995", nom: "Joana Ripoll Vall", sigles: "CIU", desDe: "1991-06-15" },
    { legislatura: "1995-1999", nom: "Marta Puig Solé", sigles: "PSC-PSOE", desDe: "1995-06-17" },
    { legislatura: "1999-2003", nom: "Marta Puig Solé", sigles: "PSC-PSOE", desDe: "1999-07-03" },
    { legislatura: "2003-2007", nom: "Marta Puig Solé", sigles: "(PSC-PSOE)-PM", desDe: "2003-06-14" },
    { legislatura: "2007-2011", nom: "Marta Puig Sole", sigles: "PSC-PM", desDe: "2007-06-16" },
    { legislatura: "2011-2015", nom: "Marta Puig Solé", sigles: "PSC-PM", desDe: null },
    { legislatura: "2015-2019", nom: "Marta Puig i Solé", sigles: "PSC-CP", desDe: null },
    { legislatura: "2019-2023", nom: "Marta Puig Solé", sigles: "PSC CP", desDe: null },
    { legislatura: "2023-2027", nom: "Pere Vidal Roca", sigles: "PSC-CP", desDe: "2023-06-17" },
  ];
  const inicis = new Map([["2011-2015", "2011-06-11"], ["2015-2019", "2015-06-13"], ["2019-2023", "2019-06-15"]]);
  const avui = new Date("2026-08-29T00:00:00Z");

  it("un canvi de nom del partit no és un canvi de mans", () => {
    const continuitat = continuitatDe(historial, inicis, avui);
    expect(continuitat.partit!.desDeLegislatura).toBe("1995-1999");
    expect(continuitat.partit!.desDeAny).toBe(1995);
    expect(continuitat.partit!.anys).toBe(31);
    expect(continuitat.partit!.legislatures).toBe(8);
    expect(continuitat.partit!.familia).toBe("psc");
    // Del 1991 al 1995 hi va haver CiU: la ratxa no arriba a l'inici de la sèrie.
    expect(continuitat.partit!.ininterromput).toBe(false);
    expect(continuitat.alternances).toBe(1);
    expect(continuitat.alternancesDetall[0]!.legislatura).toBe("1995-1999");
  });

  it("compta les persones i les forces que hi ha hagut de debò", () => {
    const continuitat = continuitatDe(historial, inicis, avui);
    // «Marta Puig Solé», «Marta Puig Sole» i «Marta Puig i Solé» són la mateixa.
    expect(continuitat.personesDiferents).toBe(3);
    expect(continuitat.forcesDiferents).toBe(2);
    expect(continuitat.legislatures).toBe(9);
    expect(continuitat.primeraLegislatura).toBe("1991-1995");
  });

  it("la persona que hi és ara porta el que porta, no el que porta el partit", () => {
    const continuitat = continuitatDe(historial, inicis, avui);
    expect(continuitat.persona!.nom).toBe("Pere Vidal Roca");
    expect(continuitat.persona!.desDe).toBe("2023-06-17");
    expect(continuitat.persona!.anys).toBe(3);
    expect(continuitat.persona!.legislatures).toBe(1);
    expect(continuitat.actual!.sigles).toBe("PSC-CP");
  });

  it("qui arriba a mig mandat no hi és des del ple de constitució", () => {
    const ambRelleu: PasAlcaldia[] = [
      ...historial,
      { legislatura: "2023-2027", nom: "Anna Serra Mir", sigles: "PSC-CP", desDe: "2025-03-04" },
    ];
    const continuitat = continuitatDe(ambRelleu, inicis, avui);
    expect(continuitat.persona!.nom).toBe("Anna Serra Mir");
    expect(continuitat.persona!.desDe).toBe("2025-03-04");
    expect(continuitat.persona!.anys).toBe(1);
    // El partit, en canvi, no s'ha mogut.
    expect(continuitat.partit!.desDeAny).toBe(1995);
  });

  it("sense historial no s'inventa cap ratxa", () => {
    const buit = continuitatDe([]);
    expect(buit.partit).toBeNull();
    expect(buit.persona).toBeNull();
    expect(buit.legislatures).toBe(0);
  });
});

describe("mateixaPersona", () => {
  it("perdona una errata i la «i» copulativa", () => {
    expect(mateixaPersona("LORENZO PALACIN BADORREY", "Lorenzo Palacín Bodorrey")).toBe(true);
    expect(mateixaPersona("Marta Puig i Solé", "MARTA PUIG SOLE")).toBe(true);
  });

  it("no ajunta dues persones diferents", () => {
    expect(mateixaPersona("Núria Marín Martínez", "Alfons García Rodríguez")).toBe(false);
    expect(mateixaPersona("Anna Serra Mir", "Anna Serra Mas")).toBe(false);
  });
});

describe("anysComplets", () => {
  it("no arrodoneix cap amunt", () => {
    expect(anysComplets("2024-10-02", new Date("2026-08-29T00:00:00Z"))).toBe(1);
    expect(anysComplets("2024-10-02", new Date("2026-10-02T00:00:00Z"))).toBe(2);
  });
});

describe("votPerdutDe", () => {
  // Xifres reals de l'Hospitalet de Llobregat el 2023, retallades a les
  // candidatures que fan falta per al càlcul.
  const participacio = {
    cens: 176_324, votants: 83_692, nuls: 1_011, blancs: 1_290,
    votsCandidatures: 81_391, votsValids: 82_681,
  };
  const llistes = [
    { sigles: "PSC-CP", vots: 31_777, escons: 13 },
    { sigles: "ERC-EUiA-AM", vots: 10_560, escons: 4 },
    { sigles: "PP", vots: 9_945, escons: 4 },
    { sigles: "VOX", vots: 8_494, escons: 3 },
    { sigles: "LHECP-C", vots: 8_126, escons: 3 },
    { sigles: "CM", vots: 3_075, escons: 0 },
    { sigles: "Cs", vots: 1_986, escons: 0 },
    { sigles: "CUP-AMUNT", vots: 1_875, escons: 0 },
    { sigles: "V..L'H", vots: 1_761, escons: 0 },
    { sigles: "VALENTS", vots: 1_252, escons: 0 },
    { sigles: "AEL'H", vots: 833, escons: 0 },
    { sigles: "DECIDEIX L'H", vots: 485, escons: 0 },
    { sigles: "UEP", vots: 362, escons: 0 },
    { sigles: "RECORTES CERO", vots: 352, escons: 0 },
    { sigles: "ARA PL", vots: 252, escons: 0 },
    { sigles: "PROPONEMOS XM", vots: 140, escons: 0 },
    { sigles: "PTDCERV", vots: 116, escons: 0 },
  ];

  it("suma el vot a llistes sense regidor, els nuls i els blancs", () => {
    const resultat = votPerdutDe(2023, participacio, llistes)!;
    expect(resultat.senseEsco!.vots).toBe(12_489);
    expect(resultat.senseEsco!.candidatures).toBe(12);
    expect(resultat.senseEsco!.mesVotada!.sigles).toBe("CM");
    expect(resultat.total!.vots).toBe(12_489 + 1_011 + 1_290);
    expect(resultat.total!.pct).toBeCloseTo(17.67, 1);
    expect(resultat.nulsIBlancs.vots).toBe(2_301);
    expect(resultat.quadra).toBe(true);
  });

  it("no publica el vot sense escó si els vots de la font no sumen els seus", () => {
    // És el cas dels 178 municipis de llistes obertes, on cada elector reparteix
    // diversos vots i sumar-los per candidatura no vol dir res.
    const resultat = votPerdutDe(2023, participacio, llistes.slice(0, 5))!;
    expect(resultat.quadra).toBe(false);
    expect(resultat.senseEsco).toBeNull();
    expect(resultat.total).toBeNull();
    // Els nuls i els blancs, en canvi, es poden dir sempre.
    expect(resultat.nulsIBlancs.pct).toBeCloseTo(2.75, 2);
  });

  it("no publica res si no hi ha vots emesos", () => {
    expect(votPerdutDe(2023, { cens: 0, votants: 0, nuls: 0, blancs: 0, votsCandidatures: 0, votsValids: 0 }, [])).toBeNull();
  });
});

describe("ratxes amb forats o amb partits desconeguts", () => {
  it("no diu «ininterromput» si la font no té alcalde en alguna legislatura", () => {
    // Cas real: Torroella de Fluvià publicava «47 anys ininterromput» quan a la
    // font no hi ha ningú per al 1983-1987 ni per al 1995-1999.
    const passos = [
      { legislatura: "1979-1983", nom: "A", sigles: "PSC-PSOE", desDe: "1979-04-19" },
      { legislatura: "1987-1991", nom: "B", sigles: "PSC-PSOE", desDe: "1987-06-30" },
      { legislatura: "2023-2027", nom: "C", sigles: "PSC-CP", desDe: "2023-06-17" },
    ];
    const c = continuitatDe(passos, new Map(), new Date("2026-08-29T00:00:00Z"));
    expect(c.partit!.ininterromput).toBe(false);
    expect(c.partit!.forats.length).toBeGreaterThan(0);
  });

  it("no allarga la ratxa a través d'un mandat sense partit conegut", () => {
    // Susqueda sortia amb «ERC-AM, 23 anys» quan la legislatura per la qual
    // començava la ratxa és justament la que no té partit.
    const passos = [
      { legislatura: "2015-2019", nom: "A", sigles: "ERC-AM", desDe: "2015-06-13" },
      { legislatura: "2019-2023", nom: "B", sigles: null, desDe: null },
      { legislatura: "2023-2027", nom: "C", sigles: "ERC-AM", desDe: "2023-06-17" },
    ];
    const c = continuitatDe(passos, new Map(), new Date("2026-08-29T00:00:00Z"));
    expect(c.partit!.desDeLegislatura).toBe("2023-2027");
    expect(c.partit!.aturadaPerDesconegut).toBe(true);
  });

  it("una ratxa sencera i sense forats sí que es pot afirmar", () => {
    const passos = [
      { legislatura: "2015-2019", nom: "A", sigles: "PSC-CP", desDe: "2015-06-13" },
      { legislatura: "2019-2023", nom: "A", sigles: "PSC-CP", desDe: "2019-06-15" },
      { legislatura: "2023-2027", nom: "A", sigles: "PSC-CP", desDe: "2023-06-17" },
    ];
    const c = continuitatDe(passos, new Map(), new Date("2026-08-29T00:00:00Z"));
    expect(c.partit!.ininterromput).toBe(true);
    expect(c.partit!.forats).toEqual([]);
  });
});
