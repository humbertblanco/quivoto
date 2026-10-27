import { describe, expect, it } from "vitest";
import {
  antiguitatDelPla, aturDarrerMes, censDeLesMunicipals, hutRegistrats, indicadorSocioeconomic,
  participacioAltraEleccio, reclamacionsGaip, taxaAturAproximada, cohortHomogenia, estatDe, extremsEmpatats, LICITACIONS_MINIMES, lloguerMitja,
  margeUltimEsco, modelGestioAigua, padroDeLAny, partitsEfectius, pisosTuristicsPer100, preuAiguaComparable,
  protegitsAcabats, ratxaAlcaldia, unaSolaOferta, veinsQuePodenVotar, volatilitatUltima, votPerdut2023,
} from "./contracte-metriques";

describe("contracte de mètriques", () => {
  it("zero és una dada i null és una absència", () => {
    expect(estatDe(0, "falta")).toEqual({ estat: "disponible", valor: 0 });
    expect(estatDe(null, "falta")).toEqual({ estat: "absent", motiu: "falta" });
  });

  it("no barreja períodes i exigeix 90% i vint observacions", () => {
    const files = Array.from({ length: 23 }, (_, i) => ({ valor: i, any: i < 21 ? 2023 : 2022 }));
    const cohort = cohortHomogenia(files, (f) => ({ valor: f.valor, periode: f.any }));
    expect(cohort?.periode).toBe("2023");
    expect(cohort?.observades).toBe(21);
    expect(cohort?.total).toBe(23);
    expect(cohortHomogenia(files.slice(0, 19), (f) => ({ valor: f.valor, periode: f.any }))).toBeNull();
  });

  it("conserva tots els municipis empatats", () => {
    expect(extremsEmpatats([{ fila: "B", valor: 7 }, { fila: "A", valor: 7 }, { fila: "C", valor: 2 }], "max"))
      .toEqual({ valor: 7, files: ["B", "A"] });
  });
});

describe("lectors de mètriques", () => {
  it("un preu de l'aigua a zero no és un preu, i el mateix val per al rànquing, el mapa i el comparador", () => {
    expect(preuAiguaComparable(0)).toBeNull();
    expect(preuAiguaComparable(null)).toBeNull();
    expect(preuAiguaComparable(0.742)).toBe(0.742);
  });

  it("el model de gestió de l'aigua es llegeix com el llegeix J19", () => {
    expect(modelGestioAigua({ gestio: { subministrament: "Directa" } })).toBe("directa");
    expect(modelGestioAigua({ gestio: { subministrament: "Indirecta - concessió" } })).toBe("indirecta");
    expect(modelGestioAigua({ gestio: { subministrament: "No presta el servei" } })).toBe("noPrestat");
    expect(modelGestioAigua({ gestio: { subministrament: "Altres" } })).toBeNull();
    expect(modelGestioAigua(undefined)).toBeNull();
  });

  it("la volatilitat només surt amb el càlcul fiable, i diu de quina elecció és", () => {
    expect(volatilitatUltima({ volatilitat: { ultima: { de: 2019, a: 2023, index: 23.53, fiable: true } } }))
      .toEqual({ index: 23.53, any: 2023 });
    expect(volatilitatUltima({ volatilitat: { ultima: { de: 2019, a: 2023, index: 80, fiable: false } } })).toBeNull();
    expect(volatilitatUltima({ volatilitat: { ultima: null } })).toBeNull();
  });

  it("el vot perdut només és el del 2023 i només quan la font quadra", () => {
    const vp = (darrera: string, total: unknown) => ({
      darrera, regidorsEquivalents: 1.2, eleccions: { [darrera]: { total } },
    });
    expect(votPerdut2023(vp("M20231", { pct: 6.64 }))).toEqual({ pct: 6.64, regidories: 1.2 });
    expect(votPerdut2023(vp("M20191", { pct: 6.64 }))).toBeNull();
    expect(votPerdut2023(vp("M20231", null))).toBeNull();
  });

  it("els veïns que poden votar són el cens del 2023 sobre el padró del 2023, i poden passar del 100 %", () => {
    const cens = censDeLesMunicipals({ eleccions: [{ any: 2019, cens: 9_000 }, { any: 2023, cens: 9_559 }] });
    const padro = padroDeLAny({ indicadors: [{ clau: "padroHabitants", serie: [{ any: "2023", valor: 12_848 }] }] });
    expect(cens).toBe(9_559);
    expect(padro).toBe(12_848);
    expect(veinsQuePodenVotar(cens, padro)).toBe(74.4);
    expect(veinsQuePodenVotar(108, 100)).toBe(108);
    expect(veinsQuePodenVotar(100, 0)).toBeNull();
    expect(veinsQuePodenVotar(null, 100)).toBeNull();
  });

  it("una sola oferta només amb cinc licitacions o més, i amb els anys de la finestra", () => {
    const c = (licitacions: number) => ({
      finestra: { unaOfertaPct: 40, licitacionsAmbOfertes: licitacions },
      finestraDates: { desDe: "2025-01-02", finsA: "2026-07-30" },
    });
    expect(unaSolaOferta(c(LICITACIONS_MINIMES))).toEqual({ pct: 40, licitacions: 5, periode: "2025-2026" });
    expect(unaSolaOferta(c(LICITACIONS_MINIMES - 1))).toBeNull();
  });

  it("l'habitatge: pisos turístics, pla, protegit per 1.000 habitants i lloguer amb la seva variació", () => {
    const urb = {
      pisosTuristics: { any: 2024, hutsPer100: 1.42 },
      planejament: { any: 2024, antiguitat: 36, sigla: "NNSS" },
      protegit: { desDe2023: { des: 2023, fins: 2025, iniciats: 10, acabats: 25 } },
    };
    expect(pisosTuristicsPer100(urb)).toEqual({ valor: 1.42, any: 2024, font: "urbanisme" });
    // El registre viu (J46) mana sobre el recompte del 2024, amb l'any de la consulta.
    expect(pisosTuristicsPer100(urb, { dataConsulta: "2026-10-27", hutPer100Hab: 1.87 }))
      .toEqual({ valor: 1.87, any: 2026, font: "registre" });
    // Sense padró el registre no dona ràtio, i es torna a la de l'Observatori.
    expect(pisosTuristicsPer100(urb, { dataConsulta: "2026-10-27", hutPer100Hab: null })?.font).toBe("urbanisme");
    expect(pisosTuristicsPer100(null, { dataConsulta: "2026-10-27", hutPer100Hab: 0 })).toEqual({ valor: 0, any: 2026, font: "registre" });
    expect(antiguitatDelPla(urb)).toEqual({ anys: 36, sigla: "NNSS", any: 2024 });
    expect(protegitsAcabats(urb, 10_000)).toEqual({ perMil: 2.5, acabats: 25, periode: "2023-2025" });
    // Zero és una dada: la font no en compta cap.
    expect(protegitsAcabats({ protegit: { desDe2023: { des: 2023, fins: 2025, acabats: 0 } } }, 500)?.perMil).toBe(0);
    expect(protegitsAcabats(urb, null)).toBeNull();
    expect(lloguerMitja({ preu: 792.52, darrerAny: 2025, mandat: { desDe: 2023, fins: 2025, percentual: 17.3 } }))
      .toEqual({ preu: 792.52, any: 2025, variacio: { pct: 17.3, periode: "2023-2025" } });
    expect(lloguerMitja({ preu: null, darrerAny: 2025, mandat: null })).toEqual({ preu: null, any: null, variacio: null });
  });

  it("el marge de l'última regidoria es llegeix a la defensiva: la mètrica pot no existir encara", () => {
    const marges = {
      eleccions: [
        { any: 2019, sistema: "dhondt", ultimEsco: { votsQueFaltaven: 3, guanyador: "A", perseguidor: "B" } },
        { any: 2023, sistema: "dhondt", ultimEsco: { votsQueFaltaven: 7, guanyador: "Junts per Vic", perseguidor: "Ara Vic", siglaGuanyador: "JxVIC", siglaPerseguidor: "AVIC" } },
      ],
    };
    expect(margeUltimEsco(marges)).toEqual({ vots: 7, sistema: "dhondt", guanyador: "JxVIC", perseguidor: "AVIC" });
    expect(margeUltimEsco({ eleccions: [{ any: 2023, ultimEsco: null }] })).toBeNull();
    expect(margeUltimEsco(undefined)).toBeNull();
    expect(margeUltimEsco("no és un objecte")).toBeNull();
  });

  it("els partits efectius i la ratxa surten tal com els desa la derivació", () => {
    expect(partitsEfectius({ effectiveParties: 2.43 })).toBe(2.43);
    expect(partitsEfectius({})).toBeNull();
    expect(ratxaAlcaldia({ anyReferencia: 2026, partit: { anys: 15, desDeAny: 2011 }, persona: { anys: 7 } }))
      .toEqual({ forcaAnys: 15, forcaDesDe: 2011, personaAnys: 7, referencia: 2026 });
    expect(ratxaAlcaldia(null)).toBeNull();
  });
});

describe("els lectors de la descàrrega (J43–J46)", () => {
  it("la participació d'altres eleccions, per convocatòria", () => {
    const altres = { eleccions: [{ id: "A20241", any: 2024, participacio: 61.3 }, { id: "G20231", any: 2023, participacio: null }] };
    expect(participacioAltraEleccio(altres, "A20241")).toEqual({ pct: 61.3, any: 2024 });
    expect(participacioAltraEleccio(altres, "G20231")).toBeNull();
    expect(participacioAltraEleccio(altres, "E20241")).toBeNull();
    expect(participacioAltraEleccio(null, "A20241")).toBeNull();
  });

  it("l'atur del darrer mes i la taxa aproximada; un «<5» és buit, no zero", () => {
    const socio = {
      atur: { ara: { mes: "2026-09", total: 412 } },
      taxa: { mes: "2026-08", taxa: 6.4 },
      indicadors: [
        { clau: "ist", valor: 103.2, periode: { any: 2023, provisional: false }, enllac: { href: "https://idescat.cat/x" } },
        { clau: "irpfBase", valor: null, periode: { any: 2023 } },
      ],
    };
    expect(aturDarrerMes(socio)).toEqual({ persones: 412, mes: "2026-09", any: 2026 });
    expect(aturDarrerMes({ atur: { ara: { mes: "2026-09", total: null } } })).toBeNull();
    expect(taxaAturAproximada(socio)).toEqual({ pct: 6.4, mes: "2026-08", any: 2026 });
    expect(indicadorSocioeconomic(socio, "ist")).toEqual({ valor: 103.2, any: 2023, provisional: false, enllac: "https://idescat.cat/x" });
    expect(indicadorSocioeconomic(socio, "irpfBase")).toBeNull();
  });

  it("la GAIP: zero reclamacions és una dada, i els incompliments es compten", () => {
    const gaip = (n: number) => ({
      mandat: { des: "2023-06-17", reclamacions: n, sentit: { estimacio: 1, estimacioParcial: 2 } },
      incompliments: [{ reclamacio: "1" }],
    });
    expect(reclamacionsGaip(gaip(7))).toEqual({ reclamacions: 7, estimades: 3, incompliments: 1, desDe: "2023-06-17" });
    expect(reclamacionsGaip(gaip(0))?.reclamacions).toBe(0);
    expect(reclamacionsGaip(null)).toBeNull();
  });

  it("els pisos turístics del registre, amb l'any de la consulta", () => {
    expect(hutRegistrats({ dataConsulta: "2026-10-27", hut: { establiments: 997, places: 5000, ambPlaces: 990 } })).toEqual({ hut: 997, any: 2026 });
    expect(hutRegistrats({ dataConsulta: "2026-10-27", hut: { establiments: 0 } })).toEqual({ hut: 0, any: 2026 });
    expect(hutRegistrats({ hut: { establiments: 3 } })).toBeNull();
  });
});
