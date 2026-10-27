import { describe, expect, it } from "vitest";
import { PROCEDIMENTS, type AnyAbss, type AnyContractesEns, type ServeisEnsDesats, type ServeisSocialsDesats } from "../jobs/j42-serveis-ens";
import {
  aArticle,
  ambArticle,
  anyDeReferencia,
  anysEnText,
  darrerAnyAmbPersones,
  enllacosIndexServeis,
  euros,
  notaGestors,
  notesSerie,
  partDe,
  renderContractacioEns,
  renderServeisEns,
  renderServeisSocialsEns,
  renderServeisSocialsMunicipi,
  SERVEIS_ENS_CSS,
  taulaSerie,
} from "./serveis-ens-fitxa";

const font = { nom: "Font de prova", url: "https://analisi.transparenciacatalunya.cat/d/fvnd-jbxf", llicencia: null, consultat: "2026-10-27" };

const any = (n: number, persones: number | null, extra: Partial<AnyAbss> = {}): AnyAbss => ({
  any: n,
  persones,
  sadSocial: { persones: persones === null ? null : 40, hores: persones === null ? null : 3_000 },
  sadDependencia: { persones: persones === null ? null : 60, hores: persones === null ? null : 4_500 },
  gestor: null,
  zeroLlegitComBuit: false,
  codiNoQuadra: false,
  ...extra,
});

const serveis = (anys: AnyAbss[]): ServeisSocialsDesats => ({ codiEns: "8100170005", nom: "Consell Comarcal de l'Alt Camp", anys, fonts: [font] });

const anyContractes = (n: number, extra: Partial<AnyContractesEns> = {}): AnyContractesEns => ({
  any: n,
  complet: true,
  contractes: 100,
  import: 1_000_000,
  senseImport: 0,
  perProcediment: PROCEDIMENTS.map((procediment) => ({
    procediment,
    contractes: procediment === "menor" ? 90 : procediment === "obert" ? 10 : 0,
    import: procediment === "menor" ? 200_000 : procediment === "obert" ? 800_000 : 0,
  })),
  perTipus: [
    { tipus: "Serveis", contractes: 60, import: 700_000 },
    { tipus: "Subministraments", contractes: 40, import: 300_000 },
  ],
  procedimentsAltres: [],
  ...extra,
});

const ens = (extra: Partial<ServeisEnsDesats> = {}): ServeisEnsDesats => ({
  codiEns: "8100170005",
  ens: "Consell Comarcal de l'Alt Camp",
  tipus: "consell",
  serveisSocials: serveis([any(2022, 3_547), any(2023, null, { zeroLlegitComBuit: true }), any(2024, 3_394)]),
  altresArees: [],
  contractacio: { anys: [anyContractes(2025), anyContractes(2026, { complet: false, contractes: 20 })], font, detall: "https://contractaciopublica.cat/" },
  consultat: "2026-10-27",
  ...extra,
});

describe("petites eines", () => {
  it("escriu els euros com es diuen", () => {
    expect(euros(113_375_000)).toBe("113,4 milions d'euros");
    expect(euros(554_321)).toBe("554.000 euros");
    expect(euros(980)).toBe("980 euros");
  });

  it("diu els anys seguits com un tram i els saltats d'un en un", () => {
    expect(anysEnText([2023])).toBe("del 2023");
    expect(anysEnText([2018, 2019, 2020])).toBe("del 2018 al 2020");
    expect(anysEnText([2018, 2019, 2023])).toBe("dels anys 2018, 2019 i 2023");
    expect(anysEnText([])).toBe("");
  });

  it("posa l'article bo al nom d'un ens", () => {
    expect(ambArticle("Consorci d'Osona de Serveis Socials")).toBe("el Consorci d'Osona de Serveis Socials");
    expect(ambArticle("Mancomunitat Intermunicipal Voluntària La Plana")).toBe("la Mancomunitat Intermunicipal Voluntària La Plana");
    expect(aArticle("Consorci d'Acció Social de la Garrotxa")).toBe("al Consorci d'Acció Social de la Garrotxa");
    expect(aArticle("Mancomunitat La Plana")).toBe("a la Mancomunitat La Plana");
  });

  it("troba l'últim any amb persones i l'últim any complet de contractes", () => {
    expect(darrerAnyAmbPersones([any(2023, 10), any(2024, null)])!.any).toBe(2023);
    expect(darrerAnyAmbPersones([any(2024, null)])).toBeNull();
    expect(anyDeReferencia([anyContractes(2025), anyContractes(2026, { complet: false })])!.any).toBe(2025);
    expect(anyDeReferencia([anyContractes(2026, { complet: false })])!.any).toBe(2026);
    expect(anyDeReferencia([])).toBeNull();
  });

  it("calcula les parts i no divideix per zero", () => {
    const a = anyContractes(2025);
    expect(partDe(a, "menor", "contractes")).toBe(90);
    expect(partDe(a, "obert", "import")).toBe(80);
    expect(partDe(anyContractes(2025, { import: null }), "obert", "import")).toBeNull();
    expect(partDe(anyContractes(2025, { contractes: 0 }), "menor", "contractes")).toBeNull();
  });
});

describe("la sèrie de persones ateses", () => {
  it("escriu «no consta» per als buits, amb la barra puntejada, i mai un zero", () => {
    const html = taulaSerie([any(2023, null), any(2024, 3_394)]);
    expect(html).toContain("srv-barra-buida");
    expect(html).toContain("no consta");
    expect(html).toContain("3.394");
    expect(html).not.toMatch(/>0</);
  });

  it("explica el zero llegit com a buit i el codi que no quadra només quan hi són", () => {
    expect(notesSerie([any(2024, 10)])).toBe("");
    const html = notesSerie([any(2022, 91, { codiNoQuadra: true }), any(2023, null, { zeroLlegitComBuit: true })]);
    expect(html).toContain("El 2023, la font hi escriu zero");
    expect(html).toContain("El 2022, la font porta les xifres");
  });

  it("diu qui dona la dada quan no és l'ens", () => {
    const gestor = { codiEns: "9822340003", nom: "Consorci d'Osona de Serveis Socials" };
    const html = notaGestors([any(2022, 10), any(2023, 6_163, { gestor }), any(2024, 7_393, { gestor })], "el consell");
    expect(html).toContain("Les xifres del 2023 al 2024 les dona el Consorci d'Osona de Serveis Socials, no el consell directament.");
    expect(notaGestors([any(2024, 10)], "el consell")).toBe("");
  });
});

describe("«Els serveis socials que presta»", () => {
  it("explica què és una àrea bàsica, cita la llei i dona la xifra de l'últim any", () => {
    const html = renderServeisSocialsEns(ens());
    expect(html).toContain('id="serveis-socials"');
    expect(html).toContain("Llei 12/2007");
    expect(html).toContain("20.000 habitants");
    expect(html).toContain("3.394");
    expect(html).toContain("el 2024");
    expect(html).toContain("Cada persona compta un cop");
    expect(html).toContain("40 persones (3.000 hores)");
  });

  it("a les diputacions no hi és", () => {
    expect(renderServeisSocialsEns(ens({ tipus: "diputacio", serveisSocials: null }))).toBe("");
    expect(enllacosIndexServeis(ens({ tipus: "diputacio" }))).not.toContain("serveis-socials");
  });

  it("sense dades ho diu, i no inventa cap xifra", () => {
    const html = renderServeisSocialsEns(ens({ serveisSocials: null }));
    expect(html).toContain("no publica cap xifra");
    expect(html).not.toContain("srv-gran");
    const buit = renderServeisSocialsEns(ens({ serveisSocials: serveis([any(2024, null)]) }));
    expect(buit).toContain("no publica cap xifra");
  });

  it("si la dada és d'un consorci, l'hi atribueix", () => {
    const gestor = { codiEns: "9801810007", nom: "Consorci d'Acció Social de la Garrotxa" };
    const html = renderServeisSocialsEns(ens({ serveisSocials: serveis([any(2024, 10_329, { gestor })]) }));
    expect(html).toContain("La font l'atribueix al Consorci d'Acció Social de la Garrotxa, no el consell directament.");
  });

  it("diu les altres àrees de la comarca que no compten", () => {
    const html = renderServeisSocialsEns(
      ens({ altresArees: [{ codiEns: "9002350006", nom: "Mancomunitat Intermunicipal Voluntària La Plana", any: 2024, persones: 2_505 }] }),
    );
    expect(html).toContain("una altra àrea bàsica");
    expect(html).toContain("la de la Mancomunitat Intermunicipal Voluntària La Plana (2.505 persones ateses el 2024)");
  });

  it("si al SAD no hi ha cap xifra, ho diu", () => {
    const html = renderServeisSocialsEns(
      ens({ serveisSocials: serveis([any(2024, 100, { sadSocial: { persones: null, hores: null }, sadDependencia: { persones: null, hores: null } })]) }),
    );
    expect(html).toContain("la font no en dona cap xifra");
  });
});

describe("«Com contracta»", () => {
  it("dona el total de l'últim any complet, les parts i què vol dir cada procediment", () => {
    const html = renderContractacioEns(ens());
    expect(html).toContain('id="contractacio"');
    expect(html).toContain(">100<");
    expect(html).toContain("el 2025");
    expect(html).toContain("1,0 milions d'euros");
    expect(html).toContain("el 90&nbsp;% van ser contractes menors");
    expect(html).toContain("els oberts en sumen el 80&nbsp;%");
    expect(html).toContain("15.000 euros");
    expect(html).toContain("en curs");
    expect(html).toContain("Plataforma de serveis de");
  });

  it("no pinta cap procediment que no hi és ni cap nom d'empresa", () => {
    const html = renderContractacioEns(ens());
    expect(html).not.toContain("srv-p-negociat");
    expect(html).not.toMatch(/adjudicatari|S\.L\.|S\.A\./);
  });

  it("sense import no fa servir zeros ni parts per import", () => {
    const html = renderContractacioEns(
      ens({ contractacio: { anys: [anyContractes(2025, { import: null, senseImport: 100 })], font, detall: "https://contractaciopublica.cat/" } }),
    );
    expect(html).not.toContain("Per import");
    expect(html).not.toMatch(/[^\d.]0 euros/);
    expect(html).toContain("100 contractes no porten import i no entren a la suma");
  });

  it("avisa quan no hi consta cap contracte menor, sense jutjar-ho", () => {
    const sense = anyContractes(2025, {
      perProcediment: PROCEDIMENTS.map((procediment) => ({ procediment, contractes: procediment === "obert" ? 100 : 0, import: procediment === "obert" ? 1_000_000 : 0 })),
    });
    const html = renderContractacioEns(ens({ contractacio: { anys: [sense], font, detall: "https://contractaciopublica.cat/" } }));
    expect(html).toContain("No hi consta cap contracte menor");
  });

  it("sense contractes inscrits ho diu", () => {
    const html = renderContractacioEns(ens({ contractacio: null, tipus: "diputacio" }));
    expect(html).toContain("no té cap contracte inscrit per la Diputació");
  });

  it("els dos blocs junts", () => {
    const html = renderServeisEns(ens());
    expect(html.indexOf("serveis-socials")).toBeLessThan(html.indexOf("contractacio"));
  });
});

describe("el tros de la fitxa municipal", () => {
  const martorell: ServeisSocialsDesats = {
    codiEns: "0811410007",
    nom: "Martorell",
    anys: [any(2022, 4_793), any(2023, null, { zeroLlegitComBuit: true }), any(2024, 2_707)],
    fonts: [font],
  };

  it("dona la xifra, la proporció si hi ha població i la sèrie plegada", () => {
    const html = renderServeisSocialsMunicipi(martorell, { poblacio: 29_000, anyPoblacio: 2025 });
    expect(html).toContain("2.707 persones");
    expect(html).toContain("unes 9 de cada 100 habitants (padró del 2025)");
    expect(html).toContain("<details");
    expect(html).toContain("la font hi escriu zero");
  });

  it("sense població no calcula res, i sense cap dada no surt", () => {
    expect(renderServeisSocialsMunicipi(martorell)).not.toContain("de cada 100");
    expect(renderServeisSocialsMunicipi({ ...martorell, anys: [any(2024, null)] })).toBe("");
  });
});

describe("l'estil", () => {
  it("només defineix classes amb el prefix srv-", () => {
    const classes = SERVEIS_ENS_CSS.match(/\.[a-zA-Z][\w-]*/g) ?? [];
    expect(classes.length).toBeGreaterThan(10);
    expect(classes.filter((c) => !c.startsWith(".srv-"))).toEqual([]);
  });
});
