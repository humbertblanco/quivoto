import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseEmexMassiu } from "../adapters/idescat";
import { LLICENCIA_IDESCAT } from "../jobs/j34-vehicles";
import {
  FONT_SEPE,
  NOTA_ATUR,
  NOTA_COMPETENCIES,
  aturCatalunya,
  aturDelMunicipi,
  decodificaLatin1,
  indicadorsDelMunicipi,
  parseAturSepe,
  periodesEmex,
  taxaDelMes,
  type FilaAtur,
  type SocioeconomiaMetric,
} from "../jobs/j44-socioeconomia";
import { alMes, delMes, espurnaMensual, mesEscrit, periodeText, renderSocioeconomia, renderSocioeconomiaBloc } from "./socioeconomia-fitxa";

/**
 * La mètrica es fa amb les funcions del job i els mateixos fixtures reals
 * (SEPE 2023 i 2026, EMEX del 27 d'octubre del 2026): el que es prova és el
 * que J44 desaria per a Girona i per al Brull, no una forma inventada.
 */
const FIXTURES = join(__dirname, "..", "adapters", "__fixtures__");
const files = [2023, 2026].flatMap(
  (any) => parseAturSepe(decodificaLatin1(readFileSync(join(FIXTURES, `sepe-atur-${any}.csv`)))).files,
);
const brut = JSON.parse(readFileSync(join(FIXTURES, "idescat-emex-socioeconomia-mun.json"), "utf8")) as unknown;
const emex = parseEmexMassiu(brut);
const periodes = periodesEmex(brut);
const perMesDe = (ine5: string): Map<string, FilaAtur> =>
  new Map(files.filter((f) => f.ine5 === ine5).map((f) => [f.mes, f]));

const HREF_IST = "https://www.idescat.cat/pub/?id=ist&n=14034&geo=mun:170792";

function metrica(ine5: string, idescat6: string): SocioeconomiaMetric {
  const atur = aturDelMunicipi(perMesDe(ine5), "2026-09", [2023]);
  const totsAtur = ["17079", "08026", "08019"].map((c) => aturDelMunicipi(perMesDe(c), "2026-09", [2023])!);
  const afiliats = emex.indicadors.find((i) => i.id === "f377")!.valors.get(idescat6) ?? null;
  const taxa = taxaDelMes(perMesDe(ine5), "2026-08", afiliats);
  return {
    font: {
      sepe: { ...FONT_SEPE, fitxers: [], actualitzat: "2026-09", consultat: "2026-10-27" },
      idescat: { api: "https://api.idescat.cat/emex/v1/dades.json", llicencia: LLICENCIA_IDESCAT, consultat: "2026-10-27" },
    },
    atur,
    catalunya: aturCatalunya(totsAtur, "2026-09"),
    taxa: taxa
      ? { ...taxa, comparacio: { grup: { clau: "g", etiqueta: "de 50.001 a 100.000 habitants", mida: 20, ambDada: 20 }, percentil: 64, mediana: 7.1 } }
      : null,
    indicadors: indicadorsDelMunicipi(emex, periodes, idescat6, new Map([["t213", { taula: "t213", titol: "IST", href: HREF_IST }]])),
    context: { decideixLAjuntament: false, nota: NOTA_COMPETENCIES },
    nota: NOTA_ATUR,
  };
}

describe("els mesos en català", () => {
  it("amb apòstrof quan toca", () => {
    expect(mesEscrit("2026-09")).toBe("setembre del 2026");
    expect(mesEscrit("2026-08")).toBe("agost del 2026");
    expect(alMes("2026-08")).toBe("a l'agost del 2026");
    expect(alMes("2023-06")).toBe("al juny del 2023");
    expect(delMes("2026-10")).toBe("de l'octubre del 2026");
    expect(periodeText({ text: "2024 (p)", any: 2024, mes: null, provisional: true })).toBe("2024, provisional");
  });
});

describe("el bloc de Girona", () => {
  const html = renderSocioeconomiaBloc(metrica("17079", "170792"), { nom: "Girona" });

  it("diu l'atur d'ara i el de l'inici del mandat, amb Catalunya al costat", () => {
    expect(html).toContain("Al setembre del 2026 hi havia <b>4.275 persones</b> a l'atur registrat a Girona");
    expect(html).toContain("160 menys que al juny del 2023, quan va començar el mandat");
    expect(html).toMatch(/\(−3,6&nbsp;%\)/);
    expect(html).toMatch(/A tot Catalunya, entre els mateixos dos mesos, [+−]\d/);
  });

  it("porta la taxa aproximada i els quatre indicadors, cadascun amb el seu any", () => {
    expect(html).toContain("Taxa d'atur aproximada");
    expect(html).toContain("7,9&nbsp;%");
    expect(html).toContain("la mediana dels 20 de la seva mida, <b>7,1&nbsp;%</b>");
    expect(html).toContain("97,2");
    expect(html).toContain("2024, provisional");
    expect(html).toContain("28.899&nbsp;€");
    expect(html).toContain("1.486&nbsp;€");
    expect(html).toContain("39,1&nbsp;%");
  });

  it("cita el SEPE com demana el seu avís legal, i l'enllaç de l'Idescat verbatim", () => {
    expect(html).toContain("Origen de los datos: SEPE");
    expect(html).toContain("darrer mes publicat, setembre del 2026");
    expect(html).toContain(`href="${HREF_IST.replace(/&/g, "&amp;")}"`);
    expect(html).toContain('href="https://www.idescat.cat/pub/?id=irpf"');
  });

  it("diu que això no ho decideix l'ajuntament, i no jutja", () => {
    expect(html).toContain("Què hi decideix l'ajuntament.");
    expect(html).not.toMatch(/\b(millor|pitjor|dolent|bo)\b/);
    expect(html).not.toMatch(/class="[^"]*(verd|vermell|bona|dolenta)/);
  });

  it("dibuixa la sèrie anual, amb el 2020 com a forat, i la taula per sexe i sector", () => {
    // Al fixture només hi ha el 2023 sencer: amb un sol any no hi ha línia.
    expect(html).not.toContain("serie-mitjana");
    const m = metrica("17079", "170792");
    m.atur!.anual = [
      { any: 2019, mitjana: 4881.7, mesos: 12 },
      { any: 2020, mitjana: null, mesos: 11 },
      { any: 2021, mitjana: 5700.3, mesos: 12 },
      { any: 2023, mitjana: 4568.1, mesos: 12 },
    ];
    const ambSerie = renderSocioeconomiaBloc(m);
    expect(ambSerie).toContain("serie-mitjana");
    expect(ambSerie).toMatch(/Atur registrat, mitjana de l(&#39;|')any/);
    expect(ambSerie).toMatch(/<th scope="row">2020<\/th><td>sense dada<\/td>/);
    expect(html).toContain("per sexe i per sector");
    expect(html).toContain("Sense feina anterior");
  });

  it("la mediana calculada a part mana sobre la desada", () => {
    const amb = renderSocioeconomiaBloc(metrica("17079", "170792"), {
      medianes: { mediana: 6.2, quants: 31, etiqueta: "x", percentil: 70, valors: [] },
    });
    expect(amb).toContain("la mediana dels 31 de la seva mida, <b>6,2&nbsp;%</b> · percentil 70");
  });
});

describe("un poble petit i els buits", () => {
  it("al Brull diu els mesos amagats i posa guions on la font tapa", () => {
    const html = renderSocioeconomiaBloc(metrica("08026", "080266"), { nom: "El Brull" });
    expect(html).toContain("a l'atur registrat al Brull");
    expect(html).toMatch(/En \d+ dels 40 mesos del mandat hi havia\s+menys de cinc persones/);
    expect(html).toContain("<td class=\"ara\">—</td>");
  });

  it("sense mètrica no hi ha bloc", () => {
    expect(renderSocioeconomiaBloc(null)).toBe("");
    expect(renderSocioeconomia(null)).toBe("");
    expect(renderSocioeconomia(metrica("17079", "170792"))).toContain('<section class="bloc" id="feina-i-renda">');
  });

  it("l'espurna talla la línia allà on un mes és secret", () => {
    const svg = espurnaMensual([10, 12, null, 11, 9], "2023-06");
    expect((svg.match(/M/g) ?? []).length).toBe(2);
    expect(svg).toContain("al juny del 2023");
    expect(svg).toContain("Els mesos amb menys de cinc persones la font no els publica.");
    expect(espurnaMensual([null, 3], "2023-06")).toBe("");
  });
});
