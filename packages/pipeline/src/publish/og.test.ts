import { describe, expect, it } from "vitest";
import {
  creditPla, feinaEns, feinaIndexEns, feinaMunicipi, feinaPartit, feinaTerritori, feinesGlobals, feinesPersones, hemicicleEns,
  resumDe, senyalTerritori, triaFrase,
  type Feina, type OgFitxa, type OgMunicipi,
} from "./og";
import type { DadesEns, MembreEns } from "./ens-tipus";
import { FITXER_OG } from "./seo";

/** Un municipi mínim, al qual cada prova hi afegeix només el que li interessa. */
function municipi(canvis: Partial<OgMunicipi> = {}): OgMunicipi {
  return {
    slug: "vilaprova",
    name: "Vilaprova",
    comarca: "Comarca de Prova",
    government: {
      mayorName: "Anna Puig Roca", mayorSigles: "ERC-AM", mayorSeats: 6,
      winnerSigles: "ERC-AM", winnerSeats: 6, totalSeats: 11,
      winnerGoverns: true, winnerHasMajority: true,
    },
    mayors: null,
    history: null,
    results: null,
    singleList: false,
    ...canvis,
  };
}

const pla = (html: string): string => html.replace(/<[^>]+>/g, "");

describe("triaFrase", () => {
  it("posa per davant el canvi d'alcaldia a mig mandat, encara que hi hagi pacte i llista única", () => {
    const frase = triaFrase(municipi({
      singleList: true,
      government: { ...municipi().government!, winnerGoverns: false, winnerSigles: "JxV" },
      mayors: { currentTermChange: { term: "2023-2027", mayors: [{ name: "Marta Vidal Puig", tookOfficeOn: "2025-06-14" }] } },
    }));
    expect(frase.regla).toBe("canvi-alcaldia");
    expect(frase.banda).toBe("presec");
    expect(pla(frase.html)).toContain("Marta Vidal Puig");
    expect(pla(frase.html)).toContain("juny del 2025");
  });

  it("diu que mana qui no va guanyar, i ho pinta de lavanda", () => {
    const frase = triaFrase(municipi({
      government: { ...municipi().government!, winnerGoverns: false, winnerSigles: "JxV", mayorSigles: "PSC-CP", mayorSeats: 3 },
    }));
    expect(frase.regla).toBe("pacte");
    expect(frase.banda).toBe("lavanda");
    expect(pla(frase.html)).toBe("Hi va guanyar JxV, però mana PSC-CP, amb 3 dels 11 regidors.");
  });

  it("avisa dels ajuntaments sense oposició", () => {
    expect(triaFrase(municipi({ singleList: true })).regla).toBe("llista-unica");
  });

  it("compta la ratxa de la mateixa força a partir de quatre eleccions seguides", () => {
    const serie = (families: string[]) => ({
      series: families.map((winnerFamily, i) => ({ year: 2007 + i * 4, winnerFamily })),
    });
    expect(triaFrase(municipi({ history: serie(["psc", "erc", "erc", "erc"]) })).regla).toBe("qui-mana");
    const quatre = triaFrase(municipi({ history: serie(["psc", "erc", "erc", "erc", "erc"]) }));
    expect(quatre.regla).toBe("ratxa");
    expect(pla(quatre.html)).toBe("Hi guanya ERC des del 2011: 4 eleccions municipals seguides.");
  });

  it("no diu mai que «la mateixa força» hi guanya quan són llistes locals", () => {
    // Sota `local` hi ha totes les agrupacions d'electors, i dues llistes locals
    // de dues eleccions diferents no són la mateixa força.
    const history = { series: [1999, 2003, 2007, 2011, 2015, 2019, 2023].map((year) => ({ year, winnerFamily: "local" })) };
    expect(triaFrase(municipi({ history })).regla).toBe("qui-mana");
  });

  it("distingeix la majoria absoluta del govern en minoria", () => {
    expect(pla(triaFrase(municipi()).html)).toBe("Mana Anna Puig Roca (ERC-AM) amb majoria absoluta: 6 dels 11 regidors.");
    const minoria = municipi({ government: { ...municipi().government!, mayorSeats: 4 } });
    expect(pla(triaFrase(minoria).html)).toBe("Mana Anna Puig Roca (ERC-AM) sense majoria: 4 dels 11 regidors.");
  });

  it("canvia el codi de coalició per la família política, que és el que es reconeix", () => {
    // «CM» és Compromís Municipal i surt com a sigles a 338 municipis: sol no diu res.
    const amb = municipi({
      government: { ...municipi().government!, mayorSigles: "CM", winnerSigles: "CM" },
      results: { M20231: { candidatures: [{ sigles: "CM", brandId: "junts" }] } },
    });
    expect(pla(triaFrase(amb).html)).toBe("Mana Anna Puig Roca (Junts) amb majoria absoluta: 6 dels 11 regidors.");
  });

  it("canvia les sigles que no caben per la família, en comptes de tallar-les", () => {
    const llargues = "VIU SORIGUERA-ESQUERRA REPUBLICANA DE CATALUNYA-ACORD MUNICIPAL";
    const amb = municipi({
      government: { ...municipi().government!, mayorSigles: llargues },
      results: { M20231: { candidatures: [{ sigles: llargues, brandId: "erc" }] } },
    });
    expect(pla(triaFrase(amb).html)).toContain("(ERC)");
    expect(pla(triaFrase(amb).html)).not.toContain("…");
  });

  it("no crida amb majúscules i escriu en minúscula la «i» dels cognoms", () => {
    const cridant = municipi({ government: { ...municipi().government!, mayorName: "JOAN SOLÀ I FONT" } });
    expect(pla(triaFrase(cridant).html)).toContain("Joan Solà i Font");
  });

  it("cau al guanyador quan no sap de quina llista és l'alcaldia", () => {
    const orfe = municipi({
      government: { ...municipi().government!, mayorSigles: null, mayorSeats: null, winnerSigles: "CM", winnerSeats: 6 },
      results: { M20231: { candidatures: [{ sigles: "CM", brandId: "junts" }] } },
    });
    const frase = triaFrase(orfe);
    expect(frase.regla).toBe("guanyador");
    expect(pla(frase.html)).toBe("El 2023 hi va guanyar Junts, amb 6 dels 11 regidors.");
  });

  it("sempre en surt una frase, fins i tot sense cap dada", () => {
    const buit = triaFrase(municipi({ government: null }));
    expect(buit.regla).toBe("sense-dades");
    expect(pla(buit.html).length).toBeGreaterThan(10);
  });

  it("escapa el que ve de la font i només hi deixa passar <b>", () => {
    const brut = municipi({ government: { ...municipi().government!, mayorName: "Anna <script>alert(1)</script> & Cia" } });
    const html = triaFrase(brut).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html.replace(/<\/?b>/g, "")).not.toMatch(/<[^>]/);
  });
});

/** Una fitxa sencera, amb el ple i l'historial: el que carrega `loadOgMunicipis`. */
function fitxa(canvis: Partial<OgFitxa> = {}): OgFitxa {
  const { results: _results, ...base } = municipi();
  return {
    ...base,
    ine5: "00000",
    results: null,
    carrecs: {
      carrecs: [
        // Un retrat que no és a disc: la imatge ha de caure a les inicials i no petar.
        { nom: "Anna Puig Roca", carrec: "Alcaldessa", grup: "ERC-AM", equipGovern: true, foto: "/observatori/fotos/320/no-hi-es.webp", fotoPetita: null, fitxa: null },
        { nom: "Pere Vila Mas", carrec: "Regidor", grup: "AIV", equipGovern: false, foto: null, fotoPetita: null, fitxa: null },
        { nom: "Pere Vila Mas", carrec: "Regidor", grup: "AIV", equipGovern: false, foto: null, fotoPetita: null, fitxa: null },
      ],
    },
    councillors: [
      { municipalityId: 1, name: "Anna Puig Roca", role: "Alcaldessa", groupName: "ERC-AM", sigles: "ERC-AM", color: "#ffb232", brandId: "erc", orderNum: 1 },
      { municipalityId: 1, name: "Pere Vila Mas", role: "Regidor", groupName: "AIV", sigles: "AIV", color: "#123456", brandId: null, orderNum: 2 },
    ],
    mayors: {
      currentTermChange: null,
      history: [
        { term: "2011-2015", name: "JOAN SOLÀ I FONT", partyRaw: "CiU", tookOfficeOn: "2011-06-11" },
        { term: "2015-2019", name: "JOAN SOLÀ I FONT", partyRaw: "CiU", tookOfficeOn: "2015-06-13" },
        { term: "2019-2023", name: "Anna Puig Roca", partyRaw: "ERC-AM", tookOfficeOn: "2019-06-15" },
        { term: "2023-2027", name: "Anna Puig Roca", partyRaw: "ERC-AM", tookOfficeOn: "2023-06-17" },
      ],
      changes: [],
    },
    fotosExalcaldes: null,
    ...canvis,
  };
}

const persona = (f: Feina) => (f.dades.tipus === "persona" ? f.dades : null)!;

describe("les feines", () => {
  it("la imatge d'un municipi va on diu FITXER_OG, i sense escut porta la silueta del poble", () => {
    const feina = feinaMunicipi({ ...municipi(), slug: "sabadell", ine5: "00000" });
    expect(feina.fitxer).toBe(FITXER_OG.municipi("sabadell"));
    expect(feina.format).toBe("png");
    expect(feina.dades.tipus).toBe("municipi");
    if (feina.dades.tipus !== "municipi") return;
    expect(feina.dades.figura).toContain("mapa-silueta");
    expect(feina.dades.frase).toBe(triaFrase(municipi()).html);
    // Sense geometria ni escut no hi ha figura, i la imatge es fa igualment.
    expect((feinaMunicipi({ ...municipi(), slug: "poble-inventat", ine5: "00000" }).dades as { figura: string }).figura).toBe("");
  });

  it("fa una imatge per persona del ple, amb la mateixa adreça que la pàgina, i una per alcaldia amb pàgina pròpia", () => {
    const feines = feinesPersones(fitxa(), new Map());
    expect(feines.map((f) => f.fitxer)).toEqual([
      "p/vilaprova--anna-puig-roca.jpg",
      "p/vilaprova--pere-vila-mas.jpg",
      // Dos noms iguals no s'escriuen l'un damunt de l'altre: sufix, com a la pàgina.
      "p/vilaprova--pere-vila-mas-2.jpg",
      // L'alcaldia vigent té fitxa de regidor i la seva pàgina d'alcaldia redirigeix: cap imatge.
      "p/vilaprova--alcaldia--joan-sola-i-font.jpg",
    ]);
    expect(feines.every((f) => f.format === "jpeg")).toBe(true);
  });

  it("escriu el càrrec amb el municipi i la pastilla de sigles amb el color de la força", () => {
    const [alcaldessa, regidor] = feinesPersones(fitxa(), new Map()).map(persona);
    expect(alcaldessa!.carrec).toBe("Alcaldessa de Vilaprova");
    expect(alcaldessa!.on).toBe("Vilaprova · Comarca de Prova");
    expect(alcaldessa!.sigla).toContain("ERC-AM");
    // El retrat no és a disc: inicials amb el color de la marca (ERC), no gris.
    expect(alcaldessa!.retrat).toBeNull();
    expect(alcaldessa!.inicials).toBe("AP");
    expect(alcaldessa!.fons.toLowerCase()).not.toBe("#8b8b8b");
    // Sense marca coneguda mana el color de la font, a la pastilla i a les inicials.
    expect(regidor!.carrec).toBe("Regidor de Vilaprova");
    expect(regidor!.sigla).toContain("--c:#123456");
    expect(regidor!.fons).toBe("#123456");
  });

  it("l'alcaldia històrica diu el gènere quan alguna font el sap, els anys i quants mandats", () => {
    const sense = persona(feinesPersones(fitxa(), new Map()).at(-1)!);
    expect(sense.carrec).toBe("Alcaldia de Vilaprova · 2011-2019");
    expect(sense.nom).toBe("Joan Solà i Font");
    expect(sense.frase).toContain("<b>2 mandats</b>");
    expect(sense.credit).toBeNull();
    const amb = persona(feinesPersones(fitxa(), new Map([["joan sola font", "H"]])).at(-1)!);
    expect(amb.carrec).toBe("Alcalde de Vilaprova · 2011-2019");
  });

  it("sense seu electrònica, el ple surt del registre d'electes", () => {
    const feines = feinesPersones(fitxa({ carrecs: null }), new Map());
    expect(feines.filter((f) => f.fitxer.startsWith("p/vilaprova--") && !f.fitxer.includes("--alcaldia--")).map((f) => f.fitxer))
      .toEqual(["p/vilaprova--anna-puig-roca.jpg", "p/vilaprova--pere-vila-mas.jpg"]);
  });

  it("el crèdit d'un retrat de Commons diu l'autor, la llicència i l'origen, i sense autor identifica l'obra", () => {
    const base = { nom: "Algú", cami: "/x.jpg", paginaFitxer: "https://commons.wikimedia.org/x", llicencia: { nom: "CC BY-SA 4.0", url: null } };
    expect(creditPla({ ...base, autor: "Davidpar" })).toBe("Foto: Davidpar · CC BY-SA 4.0 · Wikimedia Commons");
    expect(creditPla({ ...base, autor: null, fitxer: "File:Algú.jpg" })).toBe("Foto: Algú.jpg · CC BY-SA 4.0 · Wikimedia Commons");
  });

  it("la comarca porta el mapa pintat i qui hi té més alcaldies; sense geometria, Catalunya amb els termes encesos", () => {
    const taca = (slug: string) => ({ slug, name: slug, mayorName: null, mayorSigles: null, mayorBrandId: "psc" });
    const comarca = feinaTerritori({
      slug: "valles-occidental", name: "Vallès Occidental", municipis: [taca("sabadell"), taca("terrassa")], habitants: 951000,
      forces: [{ label: "PSC", color: "#e30613", alcaldies: 10 }, { label: "Junts", color: "#00c3b2", alcaldies: 8 }],
    }, "comarca");
    expect(comarca.fitxer).toBe("c/valles-occidental.png");
    if (comarca.dades.tipus !== "territori") throw new Error("tipus");
    expect(comarca.dades.xifres).toBe("2 municipis · 951.000 habitants");
    expect(pla(comarca.dades.frase)).toBe("PSC té 10 alcaldies de 2; Junts, 8.");
    expect(comarca.dades.figura).toContain("mapa-comarca");
    const amb = feinaTerritori({ slug: "amb", name: "AMB", municipis: [taca("poble-inventat")], habitants: 1, forces: [] }, "amb");
    expect(amb.fitxer).toBe("amb.png");
    expect((amb.dades as { figura: string }).figura).toContain("senyal-territori");
    expect(senyalTerritori([taca("sabadell")])).toContain("<path d=");
  });

  it("el partit porta les sigles amb un color on la tinta es llegeix, i les tres xifres", () => {
    const feina = feinaPartit({ id: "cup", sigles: "CUP", name: "Candidatura d'Unitat Popular", color: "#ffed00", alcaldies: 1, regidories: 240, poblacioGovernada: 12345 });
    expect(feina.fitxer).toBe("partit/cup.png");
    if (feina.dades.tipus !== "partit") throw new Error("tipus");
    expect(feina.dades.tinta).toMatch(/^#/);
    expect(pla(feina.dades.frase)).toBe("1 alcaldia · 240 regidories · 12.345 habitants governats");
    // Un color que no és hexadecimal no entra a cap atribut d'estil.
    expect((feinaPartit({ id: "x", sigles: "X", name: "X", color: "red;", alcaldies: 0, regidories: 0, poblacioGovernada: 0 }).dades as { fons: string }).fons).toBe("#8b8b8b");
  });

  it("les globals són vuit, una per pàgina, amb el nom que les plantilles demanen a FITXER_OG", () => {
    const feines = feinesGlobals({ municipis: 947, comarques: 43, partits: 15, regidories: 9146, habitants: 8000000, preguntes: 12 });
    expect(feines.map((f) => f.fitxer)).toEqual(
      ["observatori", "els947", "mapa", "ranquings", "comparador", "dades", "preguntes", "trajectoria"].map(FITXER_OG.global),
    );
    for (const f of feines) {
      if (f.dades.tipus !== "global") throw new Error("tipus");
      expect(f.dades.figura).toContain("<svg");
      expect(f.dades.titol.length).toBeGreaterThan(5);
    }
  });

  it("el resum d'una imatge canvia amb les dades, el format i la plantilla, i amb res més", () => {
    const feina = feinaMunicipi({ ...municipi(), ine5: "00000" });
    expect(resumDe(feina, "v1")).toBe(resumDe({ ...feina, fitxer: "altre.png" }, "v1"));
    expect(resumDe(feina, "v1")).not.toBe(resumDe(feina, "v2"));
    expect(resumDe(feina, "v1")).not.toBe(resumDe({ ...feina, format: "jpeg" }, "v1"));
    expect(resumDe(feina, "v1")).not.toBe(resumDe(feinaMunicipi({ ...municipi(), name: "Vilanova", ine5: "00000" }), "v1"));
  });
});

describe("imatges de les diputacions i els consells", () => {
  /** Un ens mínim: només el que la imatge llegeix, amb la resta buida. */
  function ens(canvis: Partial<DadesEns> = {}): DadesEns {
    return {
      tipus: "consell", codiEns: "0000000000", nom: "Consell Comarcal del Bages", territori: "Bages", article: "el Bages",
      cif: null, gerent: null, municat: null, web: null, seients: 33, finances: null, districtes: null, wikidata: null,
      escut: null, fonts: [], avisos: [], consultat: "2026-10-27",
      slug: "bages", seu: null, membres: [], presidencia: null, poblacio: null, comarca: null, comarques: [],
      repartiment: null, subvencions: null,
      municipis: [{ slug: "manresa", nom: "Manresa", comarca: "Bages", poblacio: 79000, membres: 5 }],
      composicio: [
        { partit: "PSC", seients: 14, color: "#e30613" },
        { partit: "Junts", seients: 12, color: "#00c3b2" },
        { partit: "ERC", seients: 7, color: "red;" },
      ],
      ...canvis,
    };
  }
  const presidenta: MembreEns = {
    nom: "MARTA PUIG ROCA", carrec: "Presidenta", rol: "presidencia", ordre: 1, partit: "PSC", partitFont: "ens",
    municipiFont: null, alcaldia: false, municipi: null, adreca: null, foto: null, retribucio: null, grup: "PSC", color: "#e30613",
  };

  it("cada tipus va al seu directori de FITXER_OG, perquè el slug d'un consell és el de la comarca", () => {
    expect(feinaEns(ens()).fitxer).toBe("consell/bages.png");
    expect(feinaEns(ens({ tipus: "diputacio", slug: "girona", nom: "Diputació de Girona" })).fitxer).toBe(FITXER_OG.diputacio("girona"));
    expect(FITXER_OG.comarca("bages")).not.toBe(FITXER_OG.consell("bages"));
  });

  it("diu qui té la presidència i quin partit té més escons, amb el nom llegible", () => {
    const feina = feinaEns(ens({ presidencia: presidenta }));
    if (feina.dades.tipus !== "territori") throw new Error("tipus");
    expect(feina.dades.ambit).toBe("Consell comarcal");
    expect(feina.dades.xifres).toBe("1 municipi · 33 escons");
    expect(pla(feina.dades.frase)).toBe("Marta Puig Roca en té la presidència (PSC). PSC hi té 14 dels 33 escons.");
  });

  it("sense presidència coneguda en diu només la composició, i sense composició una frase neutra", () => {
    const sensePresidencia = feinaEns(ens({ tipus: "diputacio", nom: "Diputació de Barcelona", seients: 51 }));
    if (sensePresidencia.dades.tipus !== "territori") throw new Error("tipus");
    expect(sensePresidencia.dades.ambit).toBe("Diputació");
    expect(pla(sensePresidencia.dades.frase)).toBe("PSC hi té 14 dels 51 escons.");
    // Si de cap escó no se sap el partit, no se'n fa cap «partit amb més escons».
    const senseSigles = feinaEns(ens({ composicio: [{ partit: "sense partit conegut", seients: 33, color: null }] }));
    if (senseSigles.dades.tipus !== "territori") throw new Error("tipus");
    expect(senseSigles.dades.frase).not.toContain("sense partit");
    expect(senseSigles.dades.figura).toContain("ens-hemicicle");
    const buit = feinaEns(ens({ composicio: [], seients: 0 }));
    if (buit.dades.tipus !== "territori") throw new Error("tipus");
    expect(buit.dades.frase).not.toMatch(/\b0\b/);
    expect(buit.dades.xifres).toBe("1 municipi");
    // Sense hemicicle, Catalunya amb els municipis de l'ens encesos.
    expect(buit.dades.figura).toContain("senyal-territori");
  });

  it("diu l'empat al capdamunt en lloc de triar-ne un per ordre alfabètic", () => {
    const empat = feinaEns(ens({
      seients: 33,
      composicio: [
        { partit: "ERC", seients: 11, color: null },
        { partit: "Junts", seients: 11, color: null },
        { partit: "PSC", seients: 6, color: null },
      ],
    }));
    if (empat.dades.tipus !== "territori") throw new Error("tipus");
    expect(empat.dades.frase).toContain("ERC i Junts hi empaten amb 11 dels 33 escons");
    expect(empat.dades.frase).not.toContain("ERC hi té");
  });

  it("l'hemicicle té un cercle per escó i un color que no és hexadecimal no entra a l'atribut", () => {
    const svg = hemicicleEns(ens());
    expect(svg.match(/<circle/g)).toHaveLength(33);
    expect(svg).not.toContain("red;");
    expect(svg).toContain('fill="#8b8b8b"');
    expect(hemicicleEns(ens({ composicio: [] }))).toBe("");
  });

  it("la de l'índex compta diputacions i consells i va on diu FITXER_OG", () => {
    const feina = feinaIndexEns([ens(), ens(), ens({ tipus: "diputacio" })]);
    expect(feina.fitxer).toBe(FITXER_OG.ens());
    if (feina.dades.tipus !== "global") throw new Error("tipus");
    expect(pla(feina.dades.frase)).toBe("1 diputació i 2 consells comarcals: qui hi seu, com hi arriba i què gasta cadascun.");
  });
});
