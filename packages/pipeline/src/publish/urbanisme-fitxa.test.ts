import { describe, expect, it } from "vitest";
import { FONTS_URBANISME, type UrbanismeHabitatgeMetric } from "../jobs/j40-urbanisme-habitatge";
import { FONT_REGISTRE_TURISME, type EstablimentsTuristicsMetric } from "../jobs/j46-habitatges-turistics";
import {
  QUE_DIU_DECRET_HUT,
  URBANISME_FITXA_CSS,
  fraseObertura,
  renderUrbanismeHabitatge,
  renderUrbanismeHabitatgeBloc,
} from "./urbanisme-fitxa";

const fonts = {
  territori: { ...FONTS_URBANISME.territori, actualitzat: "2026-03-26" },
  hpo: { ...FONTS_URBANISME.hpo, actualitzat: "2026-03-18" },
  zones: { ...FONTS_URBANISME.zones, actualitzat: "2025-02-14" },
};

// Cadaqués tal com el desa J40 amb les dades del 27-10-2026 (sèrie d'HPO retallada).
const cadaques: UrbanismeHabitatgeMetric = {
  planejament: { any: 2024, figura: "Pla general d'ordenació", sigla: "PGO", antiguitat: 37, anyAprovacioAprox: 1987, adaptatLlei2002: false },
  pisosTuristics: { any: 2024, huts: 1004, placesHuts: 5522, hutsPer100: 34.69, placesTuristiques: 7338, placesTuristiquesPer100: 253.6 },
  cost: { any: 2024, lloguerPerc: 31.9, hipotecaPerc: null, catalunya: { lloguerPerc: 25.2, hipotecaPerc: 26.4 } },
  habitatgesAcabats: { any: 2024, total: 6, protegits: 0 },
  protegit: {
    serie: [
      { any: 2023, iniciats: 0, acabats: 0 },
      { any: 2024, iniciats: 0, acabats: 0 },
      { any: 2025, iniciats: 12, acabats: 0 },
    ],
    darrer: { any: 2025, iniciats: 12, acabats: 0 },
    desDe2023: { des: 2023, fins: 2025, iniciats: 12, acabats: 0 },
    total: { des: 2023, fins: 2025, iniciats: 12, acabats: 0 },
  },
  zonaTensa: { zona: "ZMRT1", vigentDes: "2024-03-16" },
  fonts,
  consultat: "2026-10-27",
};

const ctx = { nom: "Cadaqués" };

describe("bloc d'urbanisme i habitatge", () => {
  const html = renderUrbanismeHabitatge(cadaques, ctx);

  it("és una secció de la fitxa amb h2 i els cinc apartats", () => {
    expect(html).toContain('<section class="bloc" id="urbanisme">');
    expect(html).toMatch(/<h2>[^<]+<\/h2>/);
    for (const titol of ["Quin pla urbanístic té i de quan és", "Pisos turístics", "Quant costa viure-hi", "Habitatge protegit", "Zona tensa (topall de lloguer)"]) {
      expect(html).toContain(`>${titol}</h3>`);
    }
  });

  it("obre amb la resposta planera", () => {
    expect(fraseObertura(cadaques, ctx)).toContain(
      "Cadaqués es regeix per un pla urbanístic de cap al 1987, el 2024 hi havia 1.004 pisos turístics registrats i és zona tensa, amb topall de lloguer.",
    );
    expect(html).toContain("Cadaqués es regeix per un pla general d'ordenació (PGO), aprovat cap al 1987: el 2024 tenia 37 anys.");
    expect(html).toContain("El PGO és un pla general fet amb la legislació d'abans");
  });

  it("cada xifra porta any i font, i la referència de Catalunya", () => {
    expect(html).toContain("<b>31,9&nbsp;%</b> dels ingressos");
    expect(html).toContain("Catalunya, 25,2&nbsp;%");
    expect(html).toContain("dades del 2024");
    expect(html).toContain(FONTS_URBANISME.hpo.url);
    expect(html).toContain("des del 16 de març del 2024");
    expect(html).toContain("Llei estatal 12/2023");
    expect(html).toContain("llista actualitzada el 14 de febrer del 2025");
  });

  it("les dates de l'1 i de l'11 porten apòstrof: «des de l'1 de març»", () => {
    const u = renderUrbanismeHabitatgeBloc({ ...cadaques, zonaTensa: { zona: "ZMRT1", vigentDes: "2024-03-01" } }, ctx);
    expect(u).toContain("des de l'1 de març del 2024");
    expect(u).not.toContain("des del 1 ");
  });

  it("un buit és «no consta», i un zero publicat és un zero", () => {
    // La hipoteca de Cadaqués és null: no consta, mai 0 %.
    expect(html).toContain("Hipoteca sobre els ingressos</dt><dd><span class=\"urb-buit\">no consta</span>");
    expect(html).not.toContain("0,0&nbsp;%");
    // Els protegits acabats sí que són zero.
    expect(html).toContain("se'n van acabar <b>0</b>");
  });

  it("no hi ha cap veredicte ni color de veredicte", () => {
    expect(html).not.toMatch(/no compleix requisit|suspèn|aprova(t)? amb/i);
    expect(URBANISME_FITXA_CSS).not.toMatch(/green|red|#0f0|#f00/i);
    // Totes les classes noves porten el prefix.
    const classes = [...URBANISME_FITXA_CSS.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]!);
    expect(classes.every((c) => c.startsWith("urb-"))).toBe(true);
  });

  it("explica el «no» de la zona tensa i el municipi que no surt a la llista", () => {
    const no = renderUrbanismeHabitatgeBloc({ ...cadaques, zonaTensa: { zona: null, vigentDes: null } }, ctx);
    expect(no).toContain("<b>No.</b> Cadaqués no és zona de mercat residencial tensat");
    expect(no).toContain("Llei estatal 12/2023");
    const absent = renderUrbanismeHabitatgeBloc({ ...cadaques, zonaTensa: null }, ctx);
    expect(absent).toContain("no consta a la llista de zones tenses");
    expect(absent).not.toContain("<b>No.</b>");
  });
});

describe("camins buits", () => {
  it("sense mètrica diu que no consta i cita les fonts", () => {
    const buit = renderUrbanismeHabitatge(null, { nom: "la Vajol" });
    expect(buit).toContain('<section class="bloc" id="urbanisme">');
    expect(buit).toContain("No consta cap dada d'urbanisme ni d'habitatge de la Vajol");
    expect(buit).toContain(FONTS_URBANISME.zones.url);
  });

  it("amb totes les seccions buides, cada apartat diu «no consta» a la seva manera", () => {
    const res: UrbanismeHabitatgeMetric = {
      ...cadaques, planejament: null, pisosTuristics: null, cost: null, habitatgesAcabats: null, protegit: null, zonaTensa: null,
    };
    const html = renderUrbanismeHabitatgeBloc(res, { nom: "la Vajol" });
    expect(html).toContain("La font no diu quin pla");
    expect(html).toContain("La font no publica quants pisos turístics");
    expect(html).toContain("No vol dir que no costi res.");
    expect(html).toContain("La font no publica quants habitatges protegits");
    expect(html).toContain("La Vajol no consta a la llista de zones tenses");
    expect(html).toContain("Quin pla urbanístic té la Vajol");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
  });

  it("sense antiguitat ni sigla no inventa l'any ni l'abreviatura", () => {
    const html = renderUrbanismeHabitatgeBloc({
      ...cadaques,
      planejament: { any: 2024, figura: "Pla general d'ordenació plurimunicipal", sigla: null, antiguitat: null, anyAprovacioAprox: null, adaptatLlei2002: null },
    }, ctx);
    expect(html).toContain("Cadaqués es regeix per un pla general d'ordenació plurimunicipal.");
    expect(html).toContain("Un pla general d'ordenació plurimunicipal és");
    expect(html).toContain("Aprovat</dt><dd><span class=\"urb-buit\">no consta</span>");
    expect(html).not.toContain("cap al null");
  });

  it("una sèrie d'HPO tota a zero ho diu així", () => {
    const zeros = [2023, 2024, 2025].map((any) => ({ any, iniciats: 0, acabats: 0 }));
    const html = renderUrbanismeHabitatgeBloc({
      ...cadaques,
      protegit: { serie: zeros, darrer: zeros[2]!, desDe2023: { des: 2023, fins: 2025, iniciats: 0, acabats: 0 }, total: { des: 2023, fins: 2025, iniciats: 0, acabats: 0 } },
    }, ctx);
    expect(html).toContain("Entre el 2023 i el 2025 no hi consta cap habitatge protegit iniciat ni acabat.");
  });
});

// Cadaqués al registre de turisme tal com el desa J46 el 27-10-2026 (padró del 2025, 2.918 habitants).
const registreCadaques: EstablimentsTuristicsMetric = {
  dataConsulta: "2026-10-27",
  actualitzat: "2026-10-05",
  hut: { establiments: 997, places: 324, ambPlaces: 62 },
  hotels: { establiments: 31, places: 1271, ambPlaces: 31 },
  campings: { establiments: 1, places: 435, ambPlaces: 1 },
  turismeRural: { establiments: 0, places: 0, ambPlaces: 0 },
  altres: { establiments: 22, places: 182, ambPlaces: 22 },
  altresDetall: { apartaments: 1, llarsCompartides: 21, autocaravanes: 0, desconegut: 0 },
  hutPer100Hab: 34.17,
  poblacio: 2918,
  poblacioAny: 2025,
  catalunya: { hut: 104_502, municipisAmbHut: 874, hutPer100Hab: 1.3 },
  font: FONT_REGISTRE_TURISME,
};

describe("el registre de turisme d'avui (J46)", () => {
  const html = renderUrbanismeHabitatgeBloc(cadaques, { ...ctx, registre: registreCadaques });
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  it("dona la xifra d'avui amb la data i la ràtio, i la del 2024 per comparar", () => {
    expect(text).toContain("Segons el Registre de Turisme de Catalunya, consultat el 27 d'octubre del 2026, hi ha 997 pisos turístics inscrits: 34,2 per cada 100 habitants del padró del 2025");
    expect(text).toContain("El 2024, segons l'Observatori del Territori, n'hi havia 1.004");
    expect(text).toContain("Pisos turístics inscrits avui");
    expect(text).toContain("Pisos turístics el 2024");
  });

  it("l'obertura fa servir la xifra d'avui", () => {
    expect(fraseObertura(cadaques, { ...ctx, registre: registreCadaques })).toContain("avui hi ha 997 pisos turístics inscrits");
  });

  it("no publica les places dels HUT del registre, que només en porten 62 de 997", () => {
    expect(text).not.toContain("324");
  });

  it("diu els hotels i càmpings, Catalunya com a referència, el decret i la font", () => {
    expect(text).toContain("31 hotels, 1 càmping");
    expect(text).toContain("A tot Catalunya n'hi ha 104.502 d'inscrits");
    expect(html).toContain(QUE_DIU_DECRET_HUT.slice(0, 40));
    expect(QUE_DIU_DECRET_HUT).toContain("Decret llei 3/2023, de 7 de novembre");
    expect(html).toContain("https://analisi.transparenciacatalunya.cat/d/t2h3-cgys");
  });

  it("sense J40, el registre surt igualment", () => {
    const t = renderUrbanismeHabitatgeBloc(null, { nom: "Cadaqués", registre: registreCadaques }).replace(/<[^>]+>/g, " ");
    expect(t).toContain("997");
    expect(t).not.toContain("ni els pisos turístics");
  });

  it("un municipi sense cap HUT inscrit ho diu com a zero", () => {
    const zero = { ...registreCadaques, hut: { establiments: 0, places: 0, ambPlaces: 0 }, hutPer100Hab: 0 };
    const t = renderUrbanismeHabitatgeBloc(cadaques, { ...ctx, registre: zero }).replace(/<[^>]+>/g, " ");
    expect(t).toContain("no hi consta cap pis turístic inscrit");
  });
});
