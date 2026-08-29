import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  aNombre,
  cadenaDePunts,
  candidatsCapcalera,
  detectaOrgan,
  esPdf,
  esdevenimentsDeVotacio,
  extreuVotacio,
  netejaMarge,
  numeralCatala,
  parteixLlista,
  proposantDeTitol,
  segmentaPunts,
  separaGrups,
  semblaGrup,
  tipusDePunt,
} from "./actes";

/**
 * Tots els casos surten d'actes reals de l'acteca de l'AOC, retallades a
 * `__fixtures__/actes/`. Provar l'extractor amb text inventat no serveix de res:
 * el que trenca aquest codi són les rareses de cada plantilla, i les rareses no
 * se saben inventar.
 */
const fixture = (nom: string): string =>
  readFileSync(new URL(`./__fixtures__/actes/${nom}`, import.meta.url), "utf8");

describe("esPdf", () => {
  it("distingeix un PDF d'un document de Word amb l'URL acabada en .pdf", () => {
    expect(esPdf(new TextEncoder().encode("%PDF-1.7\n%âãÏÓ"))).toBe(true);
    // Capçalera d'un .docx (ZIP) i d'un .doc antic (OLE2), tots dos servits per
    // l'acteca amb extensió .pdf.
    expect(esPdf(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(false);
    expect(esPdf(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1]))).toBe(false);
    expect(esPdf(new Uint8Array([0x25]))).toBe(false);
  });
});

describe("netejaMarge", () => {
  const brut = fixture("mollet-marge-signatura.txt");
  const net = netejaMarge(brut);

  it("esborra el marge de signatura que s'intercala entre les línies del cos", () => {
    expect(brut).toContain("SIGNAT PER");
    expect(net).not.toContain("SIGNAT PER");
    expect(net).not.toContain("Codi Segur de Verificació");
  });

  it("no toca cap línia de votació", () => {
    expect(net).toContain("Vots a favor (25)");
    expect(net).toContain("Vots en contra: ningú");
    expect(net).toContain("Resultat: s’aprova per unanimitat.");
    const abans = brut.match(/vots? a favor/gi)?.length ?? 0;
    expect(net.match(/vots? a favor/gi)?.length ?? 0).toBe(abans);
  });

  it("conserva la immensa majoria del text: només treu decoració", () => {
    const proporcio = net.replace(/\s+/g, "").length / brut.replace(/\s+/g, "").length;
    expect(proporcio).toBeGreaterThan(0.8);
    expect(proporcio).toBeLessThan(1);
  });

  it("no fa res amb un document de poques pàgines, on repetir no vol dir res", () => {
    const curt = "Pàgina 1\fPàgina 2\fPàgina 3";
    expect(netejaMarge(curt)).toBe(curt);
  });
});

describe("detectaOrgan", () => {
  it("reconeix una acta de Ple", () => {
    expect(detectaOrgan(fixture("capcal-ple-roses.txt"))).toBe("ple");
  });

  it("reconeix una junta de govern, que el dataset de l'AOC hi cola igualment", () => {
    expect(detectaOrgan(fixture("capcal-junta-salt.txt"))).toBe("junta_de_govern");
  });

  it("no confon un Ple que ratifica acords de la junta de govern", () => {
    const acta = [
      "ACTA DE LA SESSIÓ DEL PLE DE L'AJUNTAMENT",
      "Ordre del dia",
      "1. Ratificació dels acords de la Junta de Govern Local de 3 de març.",
    ].join("\n");
    expect(detectaOrgan(acta)).toBe("ple");
  });

  it("no s'inventa un òrgan quan el capçal no en diu res", () => {
    expect(detectaOrgan("ACTA NÚM. 14\nA la vila, es reuneixen els membres.")).toBe("desconegut");
  });
});

describe("numerals catalans", () => {
  it("llegeix els recomptes escrits en lletres", () => {
    expect(numeralCatala("setze")).toBe(16);
    expect(numeralCatala("dèsset")).toBe(17);
    expect(numeralCatala("vint-i-tres")).toBe(23);
    expect(numeralCatala("Cap")).toBe(0);
    expect(numeralCatala("dilluns")).toBeNull();
  });

  it("accepta indistintament xifres i lletres", () => {
    expect(aNombre("21")).toBe(21);
    expect(aNombre("vint-i-un")).toBe(21);
    expect(aNombre("")).toBeNull();
    expect(aNombre(null)).toBeNull();
  });
});

describe("separaGrups", () => {
  it("llegeix la forma «8 JUNTS, 3 ERC i 1 ACTIVEM» (Olot)", () => {
    expect(separaGrups("8 JUNTS, 3 ERC i 1 ACTIVEM")).toEqual([
      { grup: "JUNTS", vots: 8 },
      { grup: "ERC", vots: 3 },
      { grup: "ACTIVEM", vots: 1 },
    ]);
  });

  it("llegeix el recompte darrere del nom, «JxCAT (7), ERC (4)» (Manlleu)", () => {
    expect(separaGrups("JxCAT (7), ERC (4) i CUP (2)")).toEqual([
      { grup: "JxCAT", vots: 7 },
      { grup: "ERC", vots: 4 },
      { grup: "CUP", vots: 2 },
    ]);
  });

  it("llegeix «9 (PSC-CP), 2 (ECP)» sense quedar-se els parèntesis (Rubí)", () => {
    expect(separaGrups("9 (PSC-CP), 2 (ECP) i 5 (ERC)")).toEqual([
      { grup: "PSC-CP", vots: 9 },
      { grup: "ECP", vots: 2 },
      { grup: "ERC", vots: 5 },
    ]);
  });

  it("accepta una llista sense cap xifra (Blanes)", () => {
    expect(separaGrups("PSC, ERC, JPB, PP i la CUP")).toEqual([
      { grup: "PSC", vots: null },
      { grup: "ERC", vots: null },
      { grup: "JPB", vots: null },
      { grup: "PP", vots: null },
      { grup: "CUP", vots: null },
    ]);
  });

  it("es treu de sobre el farciment del grup municipal (Granollers)", () => {
    expect(separaGrups("dels regidors i les regidores del grup municipal del PSC (13)")).toEqual([
      { grup: "PSC", vots: 13 },
    ]);
  });

  it("no parteix un grup per la «i» de dins d'un parèntesi (Badalona)", () => {
    expect(separaGrups("Badalona en Comú Podem (sres. Llauradó i Trenado)")).toEqual([
      { grup: "Badalona en Comú Podem", vots: null },
    ]);
  });

  it("descarta una crida nominal per cognoms, que no diu res de cap grup (Mollet)", () => {
    const nominal = "Dionisio, Broto, Pérez, Escribano, Ortiz, Baños, Segarra, Jara, Conde";
    expect(separaGrups(nominal)).toEqual([]);
  });
});

describe("parteixLlista", () => {
  it("parteix pel primer nivell i respecta els parèntesis", () => {
    expect(parteixLlista("PSC (9 regidors, 1 alcaldessa), ERC i PP")).toEqual([
      "PSC (9 regidors, 1 alcaldessa)",
      "ERC",
      "PP",
    ]);
  });
});

describe("extreuVotacio", () => {
  it("llegeix la prosa amb grups entre parèntesis (Olot)", () => {
    const votacio = extreuVotacio(fixture("olot-prosa.txt"))!;
    expect(votacio.resultat).toBe("aprovat");
    expect(votacio.recompte.favor).toBe(13);
    expect(votacio.recompte.contra).toBe(4);
    expect(votacio.recompte.abstencio).toBe(4);
    expect(votacio.perGrup).toContainEqual({ grup: "JUNTS", sentit: "favor", vots: 8 });
    expect(votacio.perGrup).toContainEqual({ grup: "PSC", sentit: "contra", vots: 4 });
    expect(votacio.perGrup).toContainEqual({ grup: "CUP", sentit: "abstencio", vots: 4 });
    expect(votacio.cita).toContain("vots a favor");
  });

  it("llegeix el bloc de tres etiquetes en majúscules (Cambrils)", () => {
    const votacio = extreuVotacio(fixture("cambrils-etiquetes.txt"))!;
    expect(votacio.perGrup).toContainEqual({ grup: "NMC", sentit: "favor", vots: 6 });
    expect(votacio.perGrup).toContainEqual({ grup: "CEPC-C", sentit: "contra", vots: 1 });
    // «ABSTENCIONS: Cap (0)» és un zero legítim, no una absència de dada.
    expect(votacio.recompte.abstencio).toBe(0);
  });

  it("llegeix una llista de grups repartida en tres línies (Sitges)", () => {
    const votacio = extreuVotacio(fixture("sitges-multilinia.txt"))!;
    const favor = votacio.perGrup.filter((v) => v.sentit === "favor").map((v) => v.grup);
    expect(favor).toContain("Esquerra Republicana de Catalunya");
    expect(favor).toContain("Sitges Grup Independent");
    // La cua d'una etiqueta no s'ha d'endur els grups de la següent.
    expect(favor).not.toContain("Junts per Sitges");
    expect(votacio.perGrup).toContainEqual({ grup: "Junts per Sitges", sentit: "abstencio", vots: 4 });
  });

  it("registra el vot per grup encara que l'acta no doni cap xifra (Blanes)", () => {
    const votacio = extreuVotacio(fixture("blanes-sense-xifra.txt"))!;
    expect(votacio.perGrup).toContainEqual({ grup: "PSC", sentit: "favor", vots: null });
    expect(votacio.perGrup).toContainEqual({ grup: "BECP", sentit: "abstencio", vots: null });
  });

  it("llegeix el bloc d'esPublico Gestiona i el marca com a unanimitat", () => {
    const votacio = extreuVotacio(fixture("vila-seca-espublico.txt"))!;
    expect(votacio.resultat).toBe("aprovat");
    expect(votacio.unanimitat).toBe(true);
    expect(votacio.perGrup).toEqual([]);
  });

  it("no marca com a unànime una votació dividida que la narració diu unànime", () => {
    // A Sant Julià de Cerdanyola un punt votat 3-1-0 tanca amb «El Ple per
    // unanimitat ACORDA». El desglossament mana sobre la narració.
    const text = [
      "Sotmesa la proposta a votació, dona el resultat següent:",
      "Vots a favor: 3 (JUNTS)",
      "Vots en contra: 1 (ERC)",
      "Abstencions: 0",
      "El Ple per unanimitat ACORDA aprovar la proposta.",
    ].join("\n");
    const votacio = extreuVotacio(text)!;
    expect(votacio.unanimitat).toBe(false);
    expect(votacio.resultat).toBe("aprovat");
  });

  it("detecta que una proposta ha estat rebutjada quan hi ha més contraris", () => {
    const text = [
      "Sotmesa la moció a votació, dona el resultat següent:",
      "Vots a favor: 7 (VOX i PP)",
      "Vots en contra: 20 (PSC-UNITS-CP, ERC i CUP)",
    ].join("\n");
    expect(extreuVotacio(text)!.resultat).toBe("rebutjat");
  });

  it("no confon el total amb el recompte del primer grup", () => {
    // «11 (TSF i GS)» és el total de dos grups; «9 (PSC-CP), 2 (ECP)» és una
    // llista i el 9 és del PSC. Els dos formats es distingeixen per la coma.
    const total = extreuVotacio("La proposta s’aprova amb la votació següent:\nVots a favor: 11 (TSF i GS)")!;
    expect(total.recompte.favor).toBe(11);
    expect(total.perGrup.map((v) => v.vots)).toEqual([null, null]);

    const llista = extreuVotacio(
      "La votació dóna el següent resultat:\nVots a favor: 9 (PSC-CP), 2 (ECP) i 5 (ERC)",
    )!;
    expect(llista.recompte.favor).toBe(16);
    expect(llista.perGrup).toContainEqual({ grup: "PSC-CP", sentit: "favor", vots: 9 });
  });

  it("retorna null quan al text no s'hi vota res", () => {
    expect(extreuVotacio("2. Donar compte dels decrets d'alcaldia del mes de maig.")).toBeNull();
  });
});

describe("segmentaPunts", () => {
  it("es queda amb la cadena de punts que cobreix més text, no amb l'índex", () => {
    // Un índex al davant amb els mateixos números que el cos: si guanyés
    // l'índex, tota l'acta cauria dins de l'últim punt.
    const acta = [
      "ÍNDEX",
      "1. Aprovació de l'acta de la sessió anterior",
      "2. Aprovació del pressupost",
      "3. Moció del grup municipal d'ERC sobre l'habitatge",
      "",
      "1. Aprovació de l'acta de la sessió anterior",
      ...Array(30).fill("Text del primer punt."),
      "2. Aprovació del pressupost",
      ...Array(30).fill("Text del segon punt."),
      "3. Moció del grup municipal d'ERC sobre l'habitatge",
      ...Array(30).fill("Text del tercer punt."),
    ].join("\n");
    const punts = segmentaPunts(acta);
    expect(punts).toHaveLength(3);
    expect(punts[0]!.text).toContain("Text del primer punt.");
    expect(punts[2]!.titol).toContain("Moció del grup municipal");
  });

  it("no compta com a punt una llista d'antecedents que reinicia a 1", () => {
    const candidats = candidatsCapcalera(
      [
        "1. Aprovació de l'acta de la sessió anterior",
        "2. Aprovació inicial del pressupost general",
        "ANTECEDENTS",
        "1. Aprovació de la memòria de l'alcaldia",
        "2. Aprovació de l'informe d'intervenció",
        "3. Moció del grup municipal de la CUP sobre el transport",
      ].join("\n"),
    );
    const cadena = cadenaDePunts(candidats);
    expect(cadena.map((c) => c.numero)).toEqual(["1", "2", "3"]);
  });
});

describe("esdevenimentsDeVotacio", () => {
  it("compta un sol esdeveniment encara que el bloc dispari tres ancoratges", () => {
    const text = [
      "Sotmesa la proposta a votació, s'aprova per unanimitat amb 21 vots a favor.",
      "".padEnd(2000, " "),
      "Sotmesa la moció a votació, s'aprova amb 13 vots a favor i 8 en contra.",
    ].join("\n");
    expect(esdevenimentsDeVotacio(text)).toHaveLength(2);
  });
});

describe("tipusDePunt i proposantDeTitol", () => {
  it("classifica el punt pel títol", () => {
    expect(tipusDePunt("Moció del grup municipal d'ERC per un habitatge digne")).toBe("mocio");
    expect(tipusDePunt("Donar compte dels decrets d'alcaldia")).toBe("donar_compte");
    expect(tipusDePunt("Aprovació de l'acta de la sessió anterior")).toBe("acta");
    expect(tipusDePunt("Precs i preguntes")).toBe("precs");
    expect(tipusDePunt("Aprovació inicial del pressupost general per al 2026")).toBe("acord");
  });

  it("treu qui presenta la moció, encara que no sigui un partit", () => {
    expect(proposantDeTitol("Moció del grup municipal d'ERC per un habitatge digne")).toBe("ERC");
    expect(proposantDeTitol("Moció que presenta la CUP, relativa al transport públic")).toBe("CUP");
    // A Sabadell hi ha mocions d'una federació de veïns i d'un sindicat.
    expect(
      proposantDeTitol("Moció de la Federació d'Associacions de Veïns, sobre els barris"),
    ).toBe("Federació d'Associacions de Veïns");
    expect(proposantDeTitol("Aprovació del compte general de l'exercici 2025")).toBeNull();
  });
});

describe("errors que publicarien un vot fals", () => {
  it("llegeix les tres etiquetes quan cadascuna va a la seva línia", () => {
    // El format més corrent de tots. El `\s*` de la xifra s'empassava el salt
    // de línia, l'etiqueta següent ja no trobava l'àncora de principi de línia
    // i el recompte a favor s'acabava publicant com a vots en contra.
    const zona =
      "Sotmesa la proposta a votació, s'aprova amb el resultat següent:\n" +
      "Vots a favor: 12\nVots en contra: 9\nAbstencions: 0";
    const votacio = extreuVotacio(zona)!;
    expect(votacio.recompte.favor).toBe(12);
    expect(votacio.recompte.contra).toBe(9);
    expect(votacio.recompte.abstencio).toBe(0);
  });

  it("no accepta un tros de prosa com si fos un grup municipal", () => {
    for (const fals of [
      "Resultat: s'aprova per unanimitat",
      "S'aprova el dictamen",
      "en contra: 9 Abstencions: 0",
      "aquest punt es va tractar conjuntament amb el següent",
    ]) {
      expect(semblaGrup(fals), fals).toBe(false);
    }
  });

  it("continua acceptant els noms de grup de veritat", () => {
    for (const bo of ["PSC-CP", "ERC-AM", "Junts per Sabadell", "CUP", "Grup Municipal del PP"]) {
      expect(semblaGrup(bo), bo).toBe(true);
    }
  });

  it("no diu unanimitat si hi ha vots en contra", () => {
    // La paraula «unanimitat» pot sortir en un altre punt dins de la mateixa
    // finestra de text; el que mana és el recompte.
    const zona =
      "S'aprova per unanimitat el punt anterior.\n" +
      "Sotmesa la proposta a votació, s'aprova amb el resultat següent:\n" +
      "Vots a favor: 12\nVots en contra: 9";
    expect(extreuVotacio(zona)!.unanimitat).toBe(false);
  });

  it("sí que diu unanimitat quan no hi ha cap vot contrari", () => {
    const zona =
      "Sotmesa la proposta a votació, s'aprova per unanimitat dels 21 membres presents.";
    expect(extreuVotacio(zona)?.unanimitat).toBe(true);
  });
});
