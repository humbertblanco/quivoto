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
  it("prioritza la votació del ple davant d'un recompte citat dins la moció (Esplugues)", () => {
    const votacio = extreuVotacio(fixture("esplugues-mocio-cita-congres.txt"));
    expect(votacio).toBeNull();
  });

  it("llegeix els recomptes nominals escrits en lletres (Esplugues)", () => {
    const rebutjada = extreuVotacio(fixture("esplugues-mocio-rebutjada.txt"))!;
    expect(rebutjada.resultat).toBe("rebutjat");
    expect(rebutjada.recompte.favor).toBe(8);
    expect(rebutjada.recompte.contra).toBe(12);

    const tresSentits = extreuVotacio(fixture("esplugues-nominal-tres-sentits.txt"))!;
    expect(tresSentits.resultat).toBe("aprovat");
    expect(tresSentits.recompte.favor).toBe(14);
    expect(tresSentits.recompte.abstencio).toBe(5);
    expect(tresSentits.recompte.contra).toBe(1);
    expect(tresSentits.unanimitat).toBe(false);
    expect(tresSentits.perGrup).toEqual([]);
  });

  it("no confon una indemnització a favor de LIDL amb un vot de grup (Esplugues)", () => {
    const votacio = extreuVotacio(fixture("esplugues-nominal-unanimitat-lidl.txt"))!;
    expect(votacio.resultat).toBe("aprovat");
    expect(votacio.unanimitat).toBe(true);
    expect(votacio.recompte.favor).toBe(20);
    expect(votacio.perGrup).toEqual([]);
  });

  it("reconeix la unanimitat expressada com tots els membres presents (Esplugues)", () => {
    const votacio = extreuVotacio(fixture("esplugues-unanimitat-tots-membres.txt"))!;
    expect(votacio.resultat).toBe("aprovat");
    expect(votacio.unanimitat).toBe(true);
  });

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

/**
 * Cada cas d'aquest bloc surt d'una acta on l'extractor **publicava un vot que
 * no s'havia produït**, o on el nom del grup sortia tan brut que no hi havia
 * manera d'encaixar-lo amb cap sigla. Un vot mal atribuït és pitjor que un vot
 * que no s'extreu: acusa un partit d'haver votat el que no ha votat.
 */
describe("vot per grup: els patrons que abans s'atribuïen malament", () => {
  it("treu «Dels grups del…» del nom del grup (Ripollet)", () => {
    // El grup es desava com a «grups del PSC-CP», que no és cap sigla coneguda:
    // vot correcte, però inservible perquè no lliga amb cap marca.
    const votacio = extreuVotacio(fixture("ripollet-dels-grups.txt"))!;
    expect(votacio.perGrup).toContainEqual({ grup: "PSC-CP", sentit: "favor", vots: null });
    expect(votacio.perGrup).toContainEqual({ grup: "ERC-AM", sentit: "favor", vots: null });
    expect(votacio.perGrup).toContainEqual({ grup: "ADR", sentit: "abstencio", vots: null });
    expect(votacio.perGrup).toContainEqual({ grup: "PP", sentit: "abstencio", vots: null });
    expect(votacio.recompte.favor).toBe(12);
    expect(votacio.recompte.abstencio).toBe(9);
  });

  it("no confon una adjudicació «a favor de l'empresa X» amb un vot (Ripollet)", () => {
    // «A favor de» hi vol dir «en benefici de». L'extractor publicava
    // l'empresa adjudicatària com si hagués votat a favor de la proposta.
    const votacio = extreuVotacio(fixture("ripollet-adjudicacio-a-favor.txt"))!;
    expect(votacio.perGrup).toEqual([]);
    expect(votacio.recompte.favor).toBe(21);
  });

  it("llegeix la crida nominal agrupada i no publica els regidors com a grups (Cornellà)", () => {
    // Abans: CECP-C bé, i tot seguit vint noms de persona amb el mateix sentit
    // de vot, amb el grup següent enganxat al final d'un nom
    // («Maria Victoria Martin Herreros. d'ERC-EUiA-AM»). El PSC-CP, que és el
    // grup més gran, es perdia sencer.
    const votacio = extreuVotacio(fixture("cornella-nominal-per-grup.txt"))!;
    expect(votacio.perGrup).toEqual([
      { grup: "CECP-C", sentit: "favor", vots: 3 },
      { grup: "PSC-CP", sentit: "favor", vots: 12 },
      { grup: "PP", sentit: "contra", vots: 3 },
      { grup: "VOX", sentit: "abstencio", vots: 2 },
    ]);
  });

  it("compta els regidors de cada grup i quadra amb el total declarat (el Prat)", () => {
    // «S'abstenen: 3» és una etiqueta de vot, i sense reconèixer-la el bloc
    // quedava penjat del sentit anterior. El recompte de cada grup surt de
    // quants regidors s'enumeren i ha de sumar el total que diu l'acta.
    const votacio = extreuVotacio(fixture("prat-nominal-per-grup.txt"))!;
    const favor = votacio.perGrup.filter((v) => v.sentit === "favor");
    expect(favor.reduce((s, v) => s + (v.vots ?? 0), 0)).toBe(votacio.recompte.favor);
    expect(votacio.perGrup).toContainEqual({ grup: "Prat en Comú", sentit: "favor", vots: 9 });
    expect(votacio.perGrup).toContainEqual({
      grup: "Socialista-Candidatura de Progrés", sentit: "favor", vots: 4,
    });
    // «JORDI IBERN i TORTOSA» és una persona, no dues: la «i» que uneix dos
    // cognoms no separa regidors.
    expect(votacio.perGrup).toContainEqual({
      grup: "Esquerra Republicana de Catalunya-Acord Municipal", sentit: "abstencio", vots: 3,
    });
    expect(votacio.recompte.abstencio).toBe(3);
  });

  it("compta les sigles d'una crida nominal per regidor (Vic)", () => {
    // Abans, el total de la votació s'assignava al primer grup: «JxVIC, 13
    // vots». Aquí es compta quants regidors porta cada sigla.
    const votacio = extreuVotacio(fixture("vic-nominal-amb-sigla.txt"))!;
    expect(votacio.perGrup).toEqual([
      { grup: "JxVIC", sentit: "favor", vots: 8 },
      { grup: "ARA VIC-PL", sentit: "favor", vots: 2 },
      { grup: "SOMI", sentit: "favor", vots: 2 },
      { grup: "VECP", sentit: "favor", vots: 1 },
      { grup: "ERC-AM", sentit: "abstencio", vots: 3 },
      { grup: "CUP VIC", sentit: "abstencio", vots: 3 },
      { grup: "PSC-CP", sentit: "abstencio", vots: 2 },
    ]);
    expect(votacio.recompte.favor).toBe(13);
    expect(votacio.recompte.abstencio).toBe(8);
  });

  it("obre els claudàtors que tanquen la llista de grups (Santa Coloma)", () => {
    // El pitjor error mesurat: ERC i PP constaven votant **a favor** d'un punt
    // que havien votat en contra, perquè «[ERC i PP]» no s'obria i el sentit
    // anterior se'l quedava.
    const votacio = extreuVotacio(fixture("santa-coloma-claudators.txt"))!;
    expect(votacio.perGrup).toContainEqual({ grup: "PSC", sentit: "favor", vots: null });
    expect(votacio.perGrup).toContainEqual({ grup: "ERC", sentit: "contra", vots: null });
    expect(votacio.perGrup).toContainEqual({ grup: "PP", sentit: "contra", vots: null });
    expect(votacio.perGrup).toContainEqual({ grup: "VOX", sentit: "abstencio", vots: null });
    expect(votacio.perGrup.some((v) => v.grup.includes("["))).toBe(false);
  });

  it("llegeix la taula de distribució, grup i sentit a la mateixa línia (Barberà)", () => {
    const votacio = extreuVotacio(fixture("barbera-taula.txt"))!;
    expect(votacio.patro).toBe("taula");
    expect(votacio.perGrup).toContainEqual({ grup: "PSC-CP", sentit: "favor", vots: 7 });
    expect(votacio.perGrup).toContainEqual({ grup: "VOX", sentit: "abstencio", vots: 1 });
    expect(votacio.recompte.favor).toBe(20);
    expect(votacio.recompte.abstencio).toBe(1);
    // El títol de la columna no és un grup.
    expect(votacio.perGrup.some((v) => v.grup.includes("tipologia"))).toBe(false);
  });

  it("no talla la frase pel mig quan l'acta encadena dos sentits (Sant Just)", () => {
    // «…a favor de PSC, SJECP-C, ERC, PP i CUP-AMUNT, amb l'abstenció de la
    // resta … d'ENDAVANT SJ, JUNTSxCAT i VOX»: els tres que s'abstenien
    // constaven votant a favor.
    const votacio = extreuVotacio(fixture("sant-just-sentits-encadenats.txt"))!;
    expect(votacio.perGrup.filter((v) => v.sentit === "favor").map((v) => v.grup)).toEqual([
      "PSC", "SJECP-C", "ERC", "PP", "CUP-AMUNT",
    ]);
    expect(votacio.perGrup.filter((v) => v.sentit === "abstencio").map((v) => v.grup)).toEqual([
      "ENDAVANT SJ", "JUNTSxCAT", "VOX",
    ]);
  });
});

/**
 * L'altra meitat de la feina: saber callar. Quan la redacció no permet dir
 * quin grup ha votat què, l'extractor no ha de dir res. Un buit es pot omplir
 * després; una atribució falsa ja s'ha publicat.
 */
describe("vot per grup: quan val més no dir res", () => {
  it("no reparteix el vot nominal en columnes d'esPublico (Vila-seca)", () => {
    // El sentit va en una columna a la dreta i `pdftotext -layout` l'insereix
    // enmig dels noms: publicava «Ramírez Rubio» votant a favor i «Moya» en
    // contra, dos cognoms partits pel mig. El recompte agregat sí que es llegeix.
    const votacio = extreuVotacio(fixture("vila-seca-nominal-en-columnes.txt"))!;
    expect(votacio.perGrup).toEqual([]);
    expect(votacio.recompte).toMatchObject({ favor: 6, contra: 15, abstencio: 0, absent: 0 });
    expect(votacio.resultat).toBe("rebutjat");
  });

  it("no treu res d'una crida nominal per cognoms sense grup (Mollet)", () => {
    // Vint-i-quatre cognoms i cap sigla: no hi ha manera de saber de quin grup
    // és cadascú sense la taula d'assistents, i inventar-s'ho seria pitjor.
    expect(extreuVotacio(fixture("mollet-crida-per-cognoms.txt"))).toBeNull();
  });

  it("no accepta com a grup el que no ho és", () => {
    for (const fals of [
      "l’empresa FEU I GODOY",     // adjudicatària d'un contracte
      "la societat municipal",
      "Junta de Govern Local",
      "CIF núm. P0800258F",
      "***** URGÈNCIA",
      "S'abstenen",
      "Absents",
      "Compres",                    // nom d'una regidoria
      "Gavara",                     // cognom d'un regidor
      "Olària. Total",              // cognom amb la frase següent enganxada
      "ERC-AM, JxS-CM i IPS-CUP",   // tres grups en un
      "Jav",                        // nom de pila tallat per un salt de línia
      "C O ERC-AM",                 // lletres òrfenes del marge de signatura
    ]) {
      expect(semblaGrup(fals), fals).toBe(false);
    }
  });

  it("continua acceptant les sigles reals, també les de caixa mixta", () => {
    for (const bo of ["Vox", "Junts", "Guanyem", "GRUP BLANES", "JxVIC", "TxB – ARA PL", "SGdP"]) {
      expect(semblaGrup(bo), bo).toBe(true);
    }
  });
});

describe("noms de grup escrits a trossos", () => {
  it("torna a ajuntar la sigla que el salt de línia ha partit pel guionet", () => {
    // «ARA VIC-\n   PL» i «ARA VIC-PL» han de ser el mateix grup, o el mateix
    // partit surt dues vegades a la fitxa amb la meitat dels vots cadascuna.
    expect(separaGrups("3 ARA VIC- PL i 2 SF- ECP")).toEqual([
      { grup: "ARA VIC-PL", vots: 3 },
      { grup: "SF-ECP", vots: 2 },
    ]);
  });

  it("no es menja el «GRUP» que forma part del nom (Blanes)", () => {
    // A Blanes hi ha un partit que es diu literalment «GRUP BLANES»; el
    // farciment «dels grups municipals de» sí que s'ha de treure.
    expect(separaGrups("PSC, GRUP BLANES i la CUP")).toEqual([
      { grup: "PSC", vots: null },
      { grup: "GRUP BLANES", vots: null },
      { grup: "CUP", vots: null },
    ]);
    expect(separaGrups("dels grups municipals de PSC-CP, ADR i ERC-AM")).toEqual([
      { grup: "PSC-CP", vots: null },
      { grup: "ADR", vots: null },
      { grup: "ERC-AM", vots: null },
    ]);
  });

  it("llegeix la xifra enganxada al nom, «1VOX» (el Vendrell)", () => {
    expect(separaGrups("1VOX, 1 Primer El Vendrell i 1 Fem Vendrell")).toEqual([
      { grup: "VOX", vots: 1 },
      { grup: "Primer El Vendrell", vots: 1 },
      { grup: "Fem Vendrell", vots: 1 },
    ]);
  });
});
