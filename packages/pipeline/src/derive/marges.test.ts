import { describe, expect, it } from "vitest";
import type { CandidatLlistaOberta, EleccioLlistaOberta, LlistesObertesMetric } from "../jobs/j37-llistes-obertes";
import { construeixMarges, margesEleccioDHondt, margesEleccioOberta, type LlistaResultat } from "./marges";

/** Vic 2023, de la fitxa publicada: les set llistes amb regidoria. */
const vic2023: LlistaResultat[] = [
  { codi: "1", sigles: "CM", denominacio: "Junts per Vic - Compromís Municipal", votes: 4_029, seats: 8 },
  { codi: "2", sigles: "ERC-AM", denominacio: "Esquerra Republicana de Catalunya - Acord Municipal", votes: 1_973, seats: 3 },
  { codi: "3", sigles: "CUP-AMUNT", denominacio: null, votes: 1_727, seats: 3 },
  { codi: "4", sigles: "ARA VIC-ARA PL", denominacio: "Ara Vic - Pacte Local", votes: 1_504, seats: 2 },
  { codi: "5", sigles: "PSC-CP", denominacio: null, votes: 1_282, seats: 2 },
  { codi: "6", sigles: "SOMI", denominacio: null, votes: 1_194, seats: 2 },
  { codi: "7", sigles: "VECP-C", denominacio: null, votes: 740, seats: 1 },
  { codi: "8", sigles: "PETITA", denominacio: null, votes: 420, seats: 0 },
];
const validsVic = vic2023.reduce((a, l) => a + l.votes, 0) + 372;

describe("margesEleccioDHondt", () => {
  it("Vic 2023: l'últim regidor, de Junts per Vic, per 7 vots d'Ara Vic", () => {
    const e = margesEleccioDHondt(2023, vic2023, validsVic)!;
    expect(e).not.toBeNull();
    expect(e).toMatchObject({ any: 2023, sistema: "dhondt", escons: 21, votsValids: validsVic });
    expect(e.ultimEsco).toMatchObject({
      guanyador: "Junts per Vic - Compromís Municipal",
      siglaGuanyador: "CM",
      perseguidor: "Ara Vic - Pacte Local",
      siglaPerseguidor: "ARA VIC-ARA PL",
      votsQueFaltaven: 7,
      quocientGuanyador: 503.63,
    });
    // Sense denominació, el nom són les sigles.
    expect(e.llistes.find((l) => l.codi === "3")!.nom).toBe("CUP-AMUNT");
    // De més a menys vots, amb el percentatge sobre els vàlids.
    expect(e.llistes.map((l) => l.vots)).toEqual([...vic2023].map((l) => l.votes).sort((a, b) => b - a));
    expect(e.llistes[0]!.pct).toBeCloseTo((100 * 4_029) / validsVic, 2);
    // La llista del 3 % no arriba al 5 %.
    expect(e.llindar).toHaveLength(1);
    expect(e.llindar[0]).toMatchObject({ sigla: "PETITA", vots: 420 });
    expect(e.llindar[0]!.votsQueFaltaven).toBeGreaterThan(0);
    expect(e.majoriaAbsoluta).toMatchObject({ sigla: "CM", escons: 8, calen: 11 });
  });

  it("descarta l'elecció si el recompte no reprodueix els escons oficials", () => {
    const malament = vic2023.map((l) => (l.codi === "1" ? { ...l, seats: 9 } : l.codi === "7" ? { ...l, seats: 0 } : l));
    expect(margesEleccioDHondt(2023, malament, validsVic)).toBeNull();
  });

  it("no calcula res als plens de cinc regidories o menys (llista oberta)", () => {
    const petit: LlistaResultat[] = [
      { codi: "1", sigles: "A", denominacio: null, votes: 60, seats: 3 },
      { codi: "2", sigles: "B", denominacio: null, votes: 40, seats: 2 },
    ];
    expect(margesEleccioDHondt(2023, petit, 100)).toBeNull();
  });

  it("sense vots vàlids de la participació, suma els de les candidatures", () => {
    const e = margesEleccioDHondt(2019, vic2023, null)!;
    expect(e.votsValids).toBe(vic2023.reduce((a, l) => a + l.votes, 0));
  });
});

const persona = (
  nom: string, sigles: string, vots: number, elegit: boolean, sexe: "H" | "D" | null = "H",
): CandidatLlistaOberta => ({
  nom, clau: nom.toLowerCase(), sexe, candidatura: { codi: sigles, sigles, nom: `Llista ${sigles}` },
  vots, elegit, suplent: false,
});

/** Un poble de cinc regidories: tres d'A, dues de B; la primera que queda fora és de B. */
const poble2023: EleccioLlistaOberta = {
  any: 2023, data: "2023-05-28", regidors: 5, nomsPerPapereta: 4,
  electors: 120, votants: 95, blancs: 2, nuls: 3,
  candidats: [
    persona("Anna", "A", 60, true, "D"),
    persona("Bernat", "A", 55, true),
    persona("Carme", "B", 50, true, "D"),
    persona("Dolors", "A", 41, true, "D"),
    persona("Enric", "B", 40, true),
    persona("Ferran", "B", 37, false),
    persona("Gemma", "A", 30, false, "D"),
  ],
};

describe("margesEleccioOberta", () => {
  it("l'últim escó és de la persona elegida amb menys vots, i li calia la diferència més un", () => {
    const e = margesEleccioOberta(poble2023, null)!;
    expect(e).toMatchObject({ any: 2023, sistema: "obertes", escons: 5, votsValids: 92, llindar: [], majoriaAbsoluta: null });
    expect(e.ultimEsco).toMatchObject({
      guanyador: "Enric", perseguidor: "Ferran", votsGuanyador: 40, votsPerseguidor: 37, votsQueFaltaven: 4,
      siglaGuanyador: "B", siglaPerseguidor: "B",
    });
  });

  it("per candidatura, una més i el marge es mesuren contra les persones de les altres llistes", () => {
    const e = margesEleccioOberta(poble2023, 95)!;
    const a = e.llistes.find((l) => l.sigla === "A")!;
    const b = e.llistes.find((l) => l.sigla === "B")!;
    expect(a).toMatchObject({ escons: 3, vots: 60, nom: "Llista A" });
    expect(b).toMatchObject({ escons: 2, vots: 50 });
    // A: la Gemma (30) ha de passar l'Enric (40), l'última elegida d'una altra llista: 11 vots.
    expect(a.votsPerUnaMes).toBe(11);
    // A: la Dolors (41) pot perdre'n fins a quedar-se per sobre del Ferran (37), de B: 3.
    expect(a.margeDePerdua).toBe(3);
    // B: el Ferran (37) ha de passar la Dolors (41), d'A: 5 vots.
    expect(b.votsPerUnaMes).toBe(5);
    // B: l'Enric (40) contra la Gemma (30), la primera d'A que queda fora: 9.
    expect(b.margeDePerdua).toBe(9);
    expect(e.votsValids).toBe(95);
  });

  it("sense ningú fora, no hi ha últim escó en disputa", () => {
    const e = margesEleccioOberta({ ...poble2023, candidats: poble2023.candidats.filter((c) => c.elegit) }, null)!;
    expect(e.ultimEsco).toBeNull();
  });
});

describe("construeixMarges", () => {
  it("fa servir el vot nominal quan hi és i la llei d'Hondt quan no, en ordre cronològic", () => {
    const obertes: LlistesObertesMetric = {
      font: { nom: "", organisme: "", url: "", llicencia: "", fitxers: [], consultat: "2026-09-03" },
      ine5: "00000",
      eleccions: [poble2023],
    };
    const resultats = new Map<string, LlistaResultat[]>([["M20191", vic2023], ["M20231", vic2023]]);
    const m = construeixMarges(resultats, new Map([["M20191", validsVic]]), obertes)!;
    expect(m.eleccions.map((e) => [e.any, e.sistema])).toEqual([[2019, "dhondt"], [2023, "obertes"]]);
  });

  it("torna null si no en surt cap elecció", () => {
    expect(construeixMarges(new Map(), new Map(), null)).toBeNull();
  });
});
