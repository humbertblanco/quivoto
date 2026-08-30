import { describe, expect, it } from "vitest";
import {
  assignaSlugs, clau, marcaAmbPagina, renderCandidatura, tintaSobre, type CandidaturaData,
} from "./candidatura";
import { de } from "../lib/text";

/** Una candidatura de mostra amb prou dades per rendir la pàgina sencera. */
function mostra(canvis: Partial<CandidaturaData> = {}): CandidaturaData {
  return {
    municipality: {
      slug: "esplugues-de-llobregat", name: "Esplugues de Llobregat",
      comarca: "Baix Llobregat", provincia: "Barcelona",
      population: 46_500, electoralSystem: "llistes tancades",
    },
    slug: "psc-cp",
    sigles: "PSC-CP",
    denominacio: "Partit dels Socialistes de Catalunya - Candidatura de Progrés",
    brandId: "psc", brandName: "Partit dels Socialistes de Catalunya", brandKind: "catalan",
    partitId: "psc",
    family: "psc", lineage: null,
    color: "#D00C3C", colorIsOfficial: true,
    votes: 7794, seats: 11, share: 44.4, totalVotes: 17_545,
    totalSeats: 21, majority: 11,
    isWinner: true, winnerSigles: "PSC-CP", winnerSeats: 11, winnerHasMajority: true,
    hasMayoralty: true, mayorName: "Eduard Sanz García", mayorSigles: null, mayoraltySource: "ple",
    history: [
      { year: 2015, seats: 21, familySeats: 6, won: true, lineageSeats: null },
      { year: 2019, seats: 21, familySeats: 11, won: true, lineageSeats: null },
      { year: 2023, seats: 21, familySeats: 11, won: true, lineageSeats: null },
      { year: 2011, seats: 21, familySeats: 8, won: true, lineageSeats: null },
    ],
    firstYear: 2011,
    historyMismatch: false,
    recent: [{ year: 2019, sigles: "PSC-CP", votes: 9200, seats: 11 }],
    councillors: [
      { name: "Eduard Sanz García", role: "Alcalde President", match: "grup", foto: null, fitxa: null },
      { name: "Montserrat Zamora Angulo", role: "1a Tinent d'Alcalde", match: "grup", foto: null, fitxa: null },
    ],
    unattached: 0,
    siblings: [{ slug: "erc-am", sigles: "ERC-AM", seats: 3, color: "#ffb232" }],
    ...canvis,
  };
}

describe("clau", () => {
  it("aparella les sigles que cada font escriu a la seva manera", () => {
    // Aquest és el motiu de tot plegat: la composició del ple escriu «ERC - AM»
    // on el dataset electoral escriu «ERC-AM».
    expect(clau("ERC - AM")).toBe(clau("ERC-AM"));
    expect(clau("PSC - CP")).toBe(clau("PSC-CP"));
    expect(clau("Ad'Ab")).toBe(clau("AD AB"));
    expect(clau("ALIANÇA.CAT")).toBe("aliancacat");
  });

  it("no fon dues sigles que són de debò diferents", () => {
    expect(clau("+P-AM")).not.toBe(clau("PP-AM"));
    expect(clau("ERC-AM")).not.toBe(clau("ERC-AMUNT"));
  });
});

describe("assignaSlugs", () => {
  it("dona a cada llista el seu nom d'adreça", () => {
    expect(assignaSlugs(["PSC-CP", "ERC-AM", "VOX"])).toEqual(["psc-cp", "erc-am", "vox"]);
  });

  it("desambigua quan dues sigles diferents cauen al mateix slug", () => {
    // «+P-AM» i «P-AM» poden conviure al mateix ple i slugify les iguala.
    expect(assignaSlugs(["+P-AM", "P-AM"])).toEqual(["p-am", "p-am-2"]);
  });

  it("no deixa mai un slug buit", () => {
    const slugs = assignaSlugs(["+++", "..."]);
    expect(slugs[0]).toBe("llista-1");
    expect(slugs[1]).toBe("llista-2");
    expect(new Set(slugs).size).toBe(2);
  });
});

describe("de", () => {
  it("contrau la preposició com toca amb l'article dels topònims", () => {
    expect(de("Abrera")).toBe("d'Abrera");
    expect(de("Vic")).toBe("de Vic");
    expect(de("l'Hospitalet de Llobregat")).toBe("de l'Hospitalet de Llobregat");
    expect(de("el Prat de Llobregat")).toBe("del Prat de Llobregat");
    expect(de("els Omells de na Gaia")).toBe("dels Omells de na Gaia");
    expect(de("la Seu d'Urgell")).toBe("de la Seu d'Urgell");
    expect(de("Òdena")).toBe("d'Òdena");
    expect(de("Hostalric")).toBe("d'Hostalric");
  });
});

describe("tintaSobre", () => {
  it("posa tinta fosca sobre els colors clars i clara sobre els foscos", () => {
    // El groc de la CUP amb text blanc a sobre no es llegeix.
    expect(tintaSobre("#ffff00")).toBe("#1E1B2E");
    expect(tintaSobre("#D5D5D5")).toBe("#1E1B2E");
    expect(tintaSobre("#18307b")).toBe("#FBF7EE");
    expect(tintaSobre("#D00C3C")).toBe("#FBF7EE");
  });
});

describe("renderCandidatura", () => {
  it("diu qui és, què va treure i qui la representa", () => {
    const html = renderCandidatura(mostra(), "2026-08-29");
    expect(html).toContain("PSC-CP");
    expect(html).toContain("Partit dels Socialistes de Catalunya");
    expect(html).toContain("7.794");
    expect(html).toContain("44,4 %");
    expect(html).toContain("Eduard Sanz García");
    expect(html).toContain("1a Tinent d'Alcalde");
  });

  it("no publica cap dada de contacte", () => {
    const html = renderCandidatura(
      mostra({ councillors: [{ name: "Eduard Sanz García", role: "Alcalde President", match: "grup", foto: null, fitxa: null }] }),
      "2026-08-29",
    );
    // La font oberta porta el correu de cada regidor. Aquí no hi ha de sortir mai.
    expect(html).not.toMatch(/mailto:|href="tel:|[\w.-]+@[\w.-]+\.\w+/);
  });

  it("enllaça la fitxa del municipi i els altres grups del mateix ple", () => {
    const html = renderCandidatura(mostra(), "2026-08-29");
    expect(html).toContain('href="../"');
    expect(html).toContain('href="../erc-am/"');
  });

  it("amb majoria absoluta diu que no va caldre pactar; sense, que sí", () => {
    expect(renderCandidatura(mostra(), "2026-08-29")).toContain("no li va caldre pactar");
    const minoria = renderCandidatura(mostra({ seats: 8, winnerSeats: 8, winnerHasMajority: false }), "2026-08-29");
    expect(minoria).toContain("va caldre un pacte");
  });

  it("quan va guanyar i no governa, ho diu", () => {
    const html = renderCandidatura(
      mostra({ hasMayoralty: false, mayorSigles: "ERC-AM", isWinner: true }),
      "2026-08-29",
    );
    expect(html).toContain("la llista més votada");
    expect(html).toContain("la resta del ple va pactar");
  });

  it("quan no sabem de qui és l'alcaldia, no se l'inventa", () => {
    const html = renderCandidatura(mostra({ hasMayoralty: null, mayoraltySource: null }), "2026-08-29");
    expect(html).toContain("No sabem de quina llista és l'alcaldia");
  });

  it("sense regidors lligats no deixa la taula buida: explica per què", () => {
    const html = renderCandidatura(mostra({ councillors: [] }), "2026-08-29");
    expect(html).not.toContain("<tbody></tbody>");
    expect(html).toContain("No hem pogut lligar cap regidor");
  });

  it("amaga la sèrie quan els dos datasets no classifiquen igual la llista", () => {
    const html = renderCandidatura(mostra({ historyMismatch: true }), "2026-08-29");
    expect(html).toContain("Aquí no hi ha la sèrie històrica");
    expect(html).not.toContain('class="cand-anys"');
  });

  it("marca a part el llinatge en comptes de fingir continuïtat", () => {
    const html = renderCandidatura(
      mostra({
        sigles: "JxE-CM", family: "junts", lineage: "ciu", brandId: "junts",
        history: [
          { year: 2011, seats: 21, familySeats: 0, won: false, lineageSeats: 6 },
          { year: 2015, seats: 21, familySeats: 0, won: false, lineageSeats: 4 },
          { year: 2019, seats: 21, familySeats: 3, won: false, lineageSeats: null },
          { year: 2023, seats: 21, familySeats: 4, won: false, lineageSeats: null },
        ],
      }),
      "2026-08-29",
    );
    expect(html).toContain("no ho volem fer passar per continuïtat");
    expect(html).toContain("llinatge");
  });

  it("escapa el que ve de la font: cap sigla no pot injectar marcatge", () => {
    const html = renderCandidatura(
      mostra({ sigles: '<script>alert(1)</script>', denominacio: 'AGRUPACIÓ D\'ELECTORS "SOM POBLE"' }),
      "2026-08-29",
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;SOM POBLE&quot;");
  });

  it("un color que no sigui hexadecimal no pot sortir de l'atribut style", () => {
    const html = renderCandidatura(
      mostra({ color: "#000;} body{background:red", siblings: [{ slug: "x", sigles: "X", seats: 1, color: "javascript:alert(1)" }] }),
      "2026-08-29",
    );
    expect(html).not.toContain("body{background:red");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("--accent:#8b8b8b");
  });

  it("el fons continua sent el paper de la marca; el color del partit només és accent", () => {
    const html = renderCandidatura(mostra(), "2026-08-29");
    expect(html).toContain("--accent:#D00C3C");
    expect(html).toContain("--paper:#FBF7EE");
    expect(html).not.toContain("body{margin:0;background:#D00C3C");
  });

  it("el títol de la pàgina diu també de quin poble parla", () => {
    // Amb les sigles soles, aquesta pàgina i les altres 2.625 tenien el mateix
    // encapçalament: qui hi arriba d'un cercador no sabia de quin PSC-CP parla.
    const html = renderCandidatura(mostra(), "2026-08-29");
    const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "";
    expect(h1).toContain("PSC-CP");
    expect(h1).toContain("Esplugues de Llobregat");
  });

  it("ordena la sèrie encara que la mètrica no vingui ordenada", () => {
    // La mostra porta els anys desendreçats a posta: 2015, 2019, 2023, 2011.
    const html = renderCandidatura(mostra(), "2026-08-29");
    expect(html).toContain("Com li ha anat des del 2011");
    const anys = [...html.matchAll(/<span class="peu-any"><b>(\d{4})<\/b>/g)].map((c) => Number(c[1]));
    expect(anys).toEqual([2011, 2015, 2019, 2023]);
  });
});

// ------------------------------------------------------- les cares del grup

describe("les fotografies del ple", () => {
  const deu = (ambFoto: number): CandidaturaData["councillors"] =>
    Array.from({ length: 10 }, (_, i) => ({
      name: `Nom Cognom${i}`,
      role: i === 0 ? "Alcalde President" : "Regidoria",
      match: "grup" as const,
      foto: i < ambFoto ? `../regidor/nom-cognom${i}/foto.jpg` : null,
      fitxa: null,
    }));

  it("ensenya les cares que hi ha encara que no les tingui tothom", () => {
    // Esplugues: l'ajuntament en publica 6 de 10. Amb la regla vella de
    // tot-o-res no en sortia ni una, l'alcalde inclòs.
    const html = renderCandidatura(mostra({ councillors: deu(6) }), "2026-08-29");
    expect([...html.matchAll(/class="cara-cand" src=/g)]).toHaveLength(6);
    expect([...html.matchAll(/class="cara-cand inicials"/g)]).toHaveLength(4);
    expect(html).toContain("D'aquest grup en publica 6 de 10");
  });

  it("qui no en té rep una inicial amb el color de la seva llista, no un buit", () => {
    const html = renderCandidatura(mostra({ councillors: deu(0) }), "2026-08-29");
    // El fons de la inicial surt del color del partit i la tinta, de la fórmula
    // de contrast: mai un gris de «falta una cosa aquí».
    expect(html).toContain("--inicial-fons:#d00c3c");
    expect(html).toContain("--inicial-tinta:#FBF7EE");
    expect(html).toContain("background:var(--inicial-fons)");
    expect(html).toContain("les inicials amb el color de la llista");
  });

  it("amb el groc de la CUP la inicial continua llegint-se", () => {
    // #ffff00 amb tinta clara a sobre queda a 1,07:1. «sobreColor()» mou la
    // lluminositat el mínim fins a arribar als 4,5:1 de la norma.
    const html = renderCandidatura(
      mostra({ color: "#ffff00", councillors: deu(0) }),
      "2026-08-29",
    );
    expect(html).toContain("--inicial-tinta:#1E1B2E");
  });

  it("quan les té totes, no diu que en falti cap", () => {
    const html = renderCandidatura(mostra({ councillors: deu(10) }), "2026-08-29");
    expect(html).toContain("les retirem a la primera petició");
    expect(html).not.toContain("D'aquest grup en publica");
  });
});

// ------------------------------------------------- el camí cap a la marca

describe("marcaAmbPagina", () => {
  it("agafa l'agrupació que publica la Generalitat quan és una marca", () => {
    expect(marcaAmbPagina("psc", "PSC-CP")).toBe("psc");
    expect(marcaAmbPagina("junts", "JxCat-Junts")).toBe("junts");
  });

  it("repesca per sigles les coalicions registrades com a agrupació d'electors", () => {
    // «UA-PSC-CP» porta la marca escrita a dins i el dataset la desa com a local.
    expect(marcaAmbPagina("local", "UA-PSC-CP")).toBe("psc");
    expect(marcaAmbPagina(null, "ERC-AM")).toBe("erc");
  });

  it("no inventa marca on no n'hi ha", () => {
    // «local» no és cap partit i no té pàgina.
    expect(marcaAmbPagina("local", "GENT DEL POBLE")).toBeNull();
    expect(marcaAmbPagina(null, "TOTS PER SANT MARTÍ")).toBeNull();
  });
});

describe("l'enllaç amb la fitxa de partit", () => {
  it("hi va des de la marca de la portada i des del peu de la pàgina", () => {
    const html = renderCandidatura(mostra(), "2026-08-29");
    // Som a /observatori/m/<municipi>/<llista>/ i el partit és a
    // /observatori/partit/<id>/: tres nivells amunt, com la capçalera.
    expect(html).toContain('href="../../../partit/psc/"');
    expect([...html.matchAll(/href="\.\.\/\.\.\/\.\.\/partit\/psc\/"/g)].length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("a tot Catalunya");
  });

  it("sense marca coneguda no enllaça enlloc i ho diu", () => {
    const html = renderCandidatura(
      mostra({ partitId: null, brandId: "local", brandName: null, brandKind: "local" }),
      "2026-08-29",
    );
    // La capçalera de la casa sí que porta «Partits» a l'índex de marques: el
    // que no pot haver-hi és cap enllaç a la pàgina d'una marca concreta.
    expect(html).not.toMatch(/partit\/[a-z]+\//);
    expect(html).toContain("no té pàgina de marca");
  });

  it("posa el nom de la marca encara que el dataset la desi com a local", () => {
    // El cas d'«UA-PSC-CP»: `brandName` és nul i la marca la donen les sigles.
    const html = renderCandidatura(
      mostra({ brandId: "local", brandName: null, brandKind: null, partitId: "psc" }),
      "2026-08-29",
    );
    expect(html).toContain("Partit dels Socialistes de Catalunya");
    expect(html).toContain('href="../../../partit/psc/"');
  });
});

// ------------------------------------------------------------ els 320 píxels

describe("cap a 320 px", () => {
  it("la taula de les eleccions anteriors es desplaça ella sola", () => {
    // A 320 px el document en feia 330 i el culpable era «table.cand-recents»:
    // quatre columnes amb «9.200 vots» i «11 regidories» sense partir. Ara la
    // taula viu dins d'una caixa amb «overflow-x:auto» i el que s'arrossega és
    // la caixa, no la pàgina.
    const html = renderCandidatura(mostra(), "2026-08-29");
    const taula = html.indexOf('<table class="cand-recents">');
    const envolta = html.lastIndexOf('class="taula-envolta"', taula);
    expect(envolta).toBeGreaterThan(-1);
    expect(html.slice(envolta, taula)).not.toContain("</div>");
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    expect(css).toMatch(/\.taula-envolta\{[^}]*overflow-x:auto/);
  });

  it("res de fora d'una caixa desplaçable no té una amplada fixa que desbordi", () => {
    const html = renderCandidatura(mostra(), "2026-08-29");
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    const REGLA = /([^{}]*)\{([^{}]*)\}/g;
    const desplacables = [...css.matchAll(REGLA)]
      .filter((r) => /overflow-x:\s*auto/.test(r[2]!))
      .flatMap((r) => [...r[1]!.matchAll(/\.[A-Za-z0-9_-]+/g)].map((c) => c[0]!));
    expect(desplacables).toContain(".taula-envolta");

    const amples: number[] = [];
    for (const regla of css.replace(/@media[^{]*\{/g, "{").matchAll(REGLA)) {
      if (desplacables.some((classe) => regla[1]!.includes(classe))) continue;
      for (const decl of regla[2]!.matchAll(/(?:^|[;{\s(])((?:min-)?width):\s*(\d+)px/g)) {
        amples.push(Number(decl[2]));
      }
    }
    expect(amples.length).toBeGreaterThan(0);
    for (const ample of amples) expect(ample).toBeLessThanOrEqual(320);
  });
});

describe("renderCandidatura, la resta", () => {
  it("amb la marca local no atribueix a la llista el passat d'una altra", () => {
    // `recent` s'omple al carregador; aquí es comprova que la pàgina no dibuixa
    // la taula quan no n'hi ha.
    const html = renderCandidatura(mostra({ recent: [] }), "2026-08-29");
    expect(html).not.toContain("Com s'ha dit abans");
  });
});
