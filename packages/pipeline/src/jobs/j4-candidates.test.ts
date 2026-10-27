import { describe, expect, it } from "vitest";
import {
  aparellaLlistes, clauDeLlista, codiCanonic, llegeixCandidat,
  type CandidaturaDelsVots, type LlistaDelCens,
} from "./j4-candidates";
import { MUNICIPAL_ELECTIONS } from "@quivoto/shared-schemas/brands";

describe("llegeixCandidat", () => {
  const fila = (extra: Record<string, string | undefined> = {}) => ({
    territori_codi: "08077",
    candidatura_codi: "12",
    candidat_nom: "Concepción(conxi)",
    candidat_primer_cognom: "Sierra",
    candidat_segon_cognom: "Martín",
    candidat_posicio: "8",
    candidat_tipus: "Titular",
    electe: "N",
    ...extra,
  });

  it("ajunta el nom i el normalitza amb la clau de tot el projecte", () => {
    const c = llegeixCandidat(fila());
    // El motiu entre parèntesis no forma part del nom: sense treure'l, la
    // mateixa persona semblaria dues entre el cens de candidats i el ple.
    expect(c?.normalized).toBe("concepcion sierra martin");
    expect(c?.fullName).toBe("Concepción(conxi) Sierra Martín");
    expect(c?.posicio).toBe(8);
  });

  it("llegeix l'electe com el marca la font, i sense marca vol dir que no", () => {
    expect(llegeixCandidat(fila({ electe: "S" }))?.elected).toBe(true);
    expect(llegeixCandidat(fila({ electe: "N" }))?.elected).toBe(false);
    expect(llegeixCandidat(fila({ electe: undefined }))?.elected).toBe(false);
  });

  it("una fila sense cap nom no és ningú", () => {
    expect(
      llegeixCandidat(
        fila({ candidat_nom: "", candidat_primer_cognom: undefined, candidat_segon_cognom: undefined }),
      ),
    ).toBe(null);
  });

  it("el tipus per defecte és Titular i la posició buida és zero", () => {
    const c = llegeixCandidat(fila({ candidat_tipus: undefined, candidat_posicio: "" }));
    expect(c?.kind).toBe("Titular");
    expect(c?.posicio).toBe(0);
  });
});

/**
 * Per defecte J4 ingereix les tres municipals que J2 ja carrega de resultats:
 * és el que fa que la fitxa de cada persona pugui dir quantes vegades ha anat
 * a llistes. Comprovat el 31-08-2026 que `xnfg-weec` porta les tres senceres,
 * amb `electe` i `candidat_posicio` (42.867, 43.543 i 43.710 files).
 */
it("les eleccions per defecte de J4 són les tres municipals compartides", () => {
  expect([...MUNICIPAL_ELECTIONS]).toEqual(["M20231", "M20191", "M20151"]);
});

/**
 * Els casos reals que van fer caure 1.298 llistes del 2015 i del 2019 (i amb
 * elles la història de Jaume Collboni), copiats dels dos datasets el
 * 27-10-2026: `xnfg-weec` (el cens de candidats) i `ntc4-rnwr` (els vots).
 */
describe("aparellaLlistes", () => {
  const BCN = 19;
  const llista = (codi: string, sigles: string, denominacio: string | null = null, municipalityId = BCN): LlistaDelCens => ({
    municipalityId, codi, sigles, denominacio,
  });
  const vots = (id: number, codi: string, sigles: string, denominacio: string | null = null, municipalityId = BCN): CandidaturaDelsVots => ({
    id, municipalityId, codi, sigles, denominacio,
  });

  it("treu els zeros del davant: el 2019 els vots escriuen «080194192» i el cens «80194192»", () => {
    expect(codiCanonic("080194192")).toBe("80194192");
    expect(codiCanonic("0")).toBe("0");
    const psc = llista("80194192", "PSC-CP");
    const r = aparellaLlistes([psc, llista("86", "PP")], [vots(1, "080194192", "PSC-CP"), vots(2, "86", "PP")]);
    expect(r.parelles.get(clauDeLlista(psc))).toBe(1);
    expect(r.perCodi).toBe(2);
    expect(r.senseParella).toEqual([]);
  });

  it("el 2015 el codi és un altre de debò, i lliga per les sigles o la denominació", () => {
    // Gavà: el PSC és «82924151» al cens i «842» als vots; Cs és «301» a tots dos.
    const psc = llista("82924151", "PSC-CP", "Partit dels Socialistes de Catalunya-Candidatura D", 89);
    const cs = llista("301", "Cs", "Ciutadans-Partido de la Ciudadanía", 89);
    // Santpedor: les sigles canvien i la denominació, llevat dels espais, no.
    const pm = llista("80134150", "PM-CP", "Progrés Municipal-Candidatura de Progrés", 192);
    const r = aparellaLlistes(
      [psc, cs, pm],
      [
        vots(10, "842", "PSC-CP", "Partit dels Socialistes de Catalunya-Candidatura de Progrés", 89),
        vots(11, "301", "C's", "Ciutadans-Partido de la Ciudadanía", 89),
        vots(12, "81924150", "CP", "Progrés Municipal - Candidatura de Progrés", 192),
      ],
    );
    expect(r.parelles.get(clauDeLlista(psc))).toBe(10);
    expect(r.parelles.get(clauDeLlista(cs))).toBe(11);
    expect(r.parelles.get(clauDeLlista(pm))).toBe(12);
    expect([r.perCodi, r.perSigles, r.perDenominacio]).toEqual([1, 1, 1]);
  });

  it("si queda una llista de cada costat però no diuen el mateix, no les lliga", () => {
    // Vallromanes, 2015: «l'única que queda» aparellava partits diferents, i
    // millor cap llista que la d'un altre.
    const sain = llista("514", "SAIn", "Solidaridad y Autogestión Internacionalista", 296);
    const r = aparellaLlistes([sain], [vots(20, "905", "SI-Solidaritat", "Solidaritat per la Independència", 296)]);
    expect(r.parelles.size).toBe(0);
    expect(r.senseParella).toEqual([sain]);
  });

  it("dues llistes del cens amb el mateix codi: el codi només el pren la de les mateixes sigles", () => {
    // Vilanova del Vallès, 2015: «193» és ERC-AM i també VST al cens, i als
    // vots no hi ha cap VST. ERC lliga; VST es queda fora i no pren res.
    const erc = llista("193", "ERC-AM", "Esquerra Republicana de Catalunya-Acord Municipal", 902);
    const vst = llista("193", "VST", "Vilanova som Tots", 902);
    const r = aparellaLlistes(
      [vst, erc],
      [
        vots(30, "193", "ERC-AM", "Esquerra Republicana de Catalunya-Acord Municipal", 902),
        vots(31, "924", "CUP-CAV-PA", "CUP-Candidatures Alternatives del Vallès-Poble Actiu", 902),
      ],
    );
    expect(r.parelles.get(clauDeLlista(erc))).toBe(30);
    expect(r.parelles.has(clauDeLlista(vst))).toBe(false);
    expect(r.senseParella).toEqual([vst]);
  });

  it("unes sigles repetides no lliguen per nom, i cada municipi va a part", () => {
    const a = llista("901", "CP", null, 1);
    const b = llista("902", "CP", null, 1);
    const altre = llista("903", "CP", null, 2);
    const r = aparellaLlistes(
      [a, b, altre],
      [vots(40, "801", "CP", null, 1), vots(41, "802", "CP", null, 1), vots(42, "803", "CP", null, 2)],
    );
    expect(r.parelles.has(clauDeLlista(a))).toBe(false);
    expect(r.parelles.has(clauDeLlista(b))).toBe(false);
    expect(r.parelles.get(clauDeLlista(altre))).toBe(42);
  });
});
