import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderComparador, variacioDelMandat, type ComparadorRow } from "./comparador";

/**
 * El comparador com a eina per jutjar una gestió, no per veure una foto.
 *
 * Aquest fitxer prova el que la taula ha de fer i que no es pot comprovar
 * llegint-la: que hi hagi temps i no només nivells, que cada xifra vagi amb qui
 * governa, que un buit digui què hi falta i que comparar municipis de lligues
 * diferents avisi. Es fa sense base de dades —les files són inventades— i sense
 * navegador: el `<script>` de la pàgina s'executa aquí amb un DOM de mentida,
 * que és l'única manera de saber que el que es publica no peta en obrir-lo.
 */

// ------------------------------------------------------- la columna de temps

describe("variacioDelMandat", () => {
  const serie = [
    { year: 2015, perHead: 800 },
    { year: 2019, perHead: 421 },
    { year: 2021, perHead: 380 },
    { year: 2023, perHead: 237 },
    { year: 2024, perHead: 210 },
    { year: 2025, perHead: 190 },
  ];
  /** El que `derive/finances.ts` diu de cada mandat: quins exercicis liquidats hi cauen. */
  const mandats = [
    { id: "2019-2023", years: [2019, 2020, 2021, 2022, 2023] },
    { id: "2023-2027", years: [2023, 2024, 2025] },
  ];

  it("mesura el tros del deute que ha passat sota el govern d'ara: del primer exercici liquidat del mandat a l'últim", () => {
    const { valor, peu } = variacioDelMandat({ indicators: [], debtSeries: serie, mandates: mandats });
    expect(valor).toBe(-47);
    expect(peu).toBe("de 237 € el 2023 a 190 € el 2025");
  });

  it("fa servir l'últim exercici que hi ha, no un any fixat: amb dos anys en té prou", () => {
    const { valor, peu } = variacioDelMandat({
      indicators: [],
      debtSeries: serie,
      mandates: [{ id: "2023-2027", years: [2023, 2024] }],
    });
    expect(valor).toBe(-27);
    expect(peu).toBe("de 237 € el 2023 a 210 € el 2024");
  });

  it("sense la lectura de mandats no hi ha variació: la sèrie sola no diu de quin govern és cada any", () => {
    expect(variacioDelMandat({ indicators: [], debtSeries: serie }).valor).toBeNull();
    expect(variacioDelMandat({ indicators: [], debtSeries: serie, mandates: [] }).valor).toBeNull();
    expect(variacioDelMandat({ indicators: [] }).valor).toBeNull();
    expect(variacioDelMandat(undefined).valor).toBeNull();
  });

  it("amb un sol exercici liquidat del mandat encara no hi ha variació", () => {
    // És el cas normal els dos primers anys de mandat: la casella ho ha de dir
    // en comptes de calcular res contra un any de l'altre govern.
    const { valor, peu } = variacioDelMandat({
      indicators: [],
      debtSeries: serie,
      mandates: [{ id: "2023-2027", years: [2023] }],
    });
    expect(valor).toBeNull();
    expect(peu).toBe("");
  });

  it("un mandat que no és el d'ara no compta, encara que tingui tots els anys", () => {
    expect(
      variacioDelMandat({ indicators: [], debtSeries: serie, mandates: [mandats[0]!] }).valor,
    ).toBeNull();
  });

  it("si la sèrie no porta l'any que el mandat diu, no s'inventa res", () => {
    const { valor } = variacioDelMandat({
      indicators: [],
      debtSeries: [{ year: 2023, perHead: 237 }],
      mandates: [{ id: "2023-2027", years: [2023, 2025] }],
    });
    expect(valor).toBeNull();
  });

  it("diu qui té l'alcaldia: una variació sense govern no s'atribueix a ningú", () => {
    const { peu } = variacioDelMandat({
      indicators: [],
      debtSeries: serie,
      mandates: mandats,
      bands: [
        { id: "2015-2019", party: "CiU" },
        { id: "2019-2023", party: "PSC-CP" },
        { id: "2023-2027", party: "ERC-AM" },
      ],
    });
    expect(peu).toBe("de 237 € el 2023 a 190 € el 2025, amb ERC-AM a l'alcaldia");
  });

  it("no diu el govern quan al mandat hi ha hagut més d'una alcaldia", () => {
    // `mandateBands` deixa el partit a null quan no en pot triar un de sol: aquí
    // el peu s'ha de quedar amb les dues xifres i prou, no inventar-ne cap.
    const { peu } = variacioDelMandat({
      indicators: [],
      debtSeries: serie,
      mandates: mandats,
      bands: [{ id: "2023-2027", party: null }],
    });
    expect(peu).toBe("de 237 € el 2023 a 190 € el 2025");
  });

  it("una tirallonga de sigles no entra a la casella", () => {
    const llarga = "AGRUPACIÓ D'ELECTORS INDEPENDENTS PER LA VALL DE FOO-AM";
    const { peu } = variacioDelMandat({
      indicators: [],
      debtSeries: serie,
      mandates: mandats,
      bands: [{ id: "2023-2027", party: llarga }],
    });
    expect(peu).not.toContain("FOO");
  });

  it("un deute que no es mou no és un forat: és un zero, i es diu", () => {
    const { valor } = variacioDelMandat({
      indicators: [],
      debtSeries: [{ year: 2023, perHead: 300 }, { year: 2025, perHead: 300 }],
      mandates: [{ id: "2023-2027", years: [2023, 2025] }],
    });
    expect(valor).toBe(0);
  });
});

// ------------------------------------------------------- files de comparació

const GRAN = { grup: "de 20.001 a 50.000 habitants", mida: 88 };
const PETIT = { grup: "fins a 250 habitants", mida: 45 };

/** L'enllaç de l'Idescat del municipi, tal com el dona la seva API: mai construït. */
const ENLLAC_IDESCAT = "https://www.idescat.cat/emex/?id=080771#h40000";

function fila(
  slug: string,
  nom: string,
  lliga: { grup: string; mida: number },
  valors: Record<string, number | null>,
  textos: ComparadorRow["textos"],
  peus: Record<string, string> = {},
  enllacIdescat: string | null = ENLLAC_IDESCAT,
): ComparadorRow {
  return {
    slug,
    nom,
    comarca: "Baix Llobregat",
    grup: lliga.grup,
    grupMida: lliga.mida,
    valors,
    percentils: { deute: 42, deute_mandat: 18, execucio: 71, ibi: 60, renda: 95, rebut_ibi: 4 },
    peus,
    textos,
    ...(enllacIdescat ? { enllacIdescat } : {}),
  };
}

const ESPLUGUES = fila(
  "esplugues-de-llobregat",
  "Esplugues de Llobregat",
  GRAN,
  {
    poblacio: 47_182, regidories: 21, participacio: 52.4, alternances: 1,
    deute: 237, deute_mandat: -47, estalvi: 11.7, saldo: 3.9, carrega: 6.1,
    execucio: 38.4, pmp: 21, ibi: 0.83, selectiva: null, dones: 47.6, transparencia: 92,
    cost_govern: 8.4, preu_aigua: 0.9124, rebut_ibi: 512, renda: 16_240, estrangera_pct: 11.8,
  },
  {
    govern: { principal: "PSC-CP", secundari: "Pilar Díaz Romero", color: "#d00c3c" },
    mesvotada: { principal: "Sí", secundari: "PSC-CP, amb 11 de 21" },
    majoria: { principal: "Sí", secundari: "11 de 21 regidories" },
  },
  { deute_mandat: "de 237 € el 2023 a 190 € el 2025, amb PSC-CP a l'alcaldia", ibi: "última revisió cadastral: 1990" },
);

const SANT_JUST = fila(
  "sant-just-desvern",
  "Sant Just Desvern",
  GRAN,
  {
    poblacio: 20_500, regidories: 21, participacio: 61.2, alternances: 3,
    deute: 120, deute_mandat: 52, estalvi: -3.2, saldo: -1.4, carrega: 2.8,
    execucio: 79.1, pmp: 44, ibi: 0.61, selectiva: null, dones: 52.3, transparencia: 78,
    cost_govern: 12.7, preu_aigua: 0.6412, rebut_ibi: 780, renda: 22_910, estrangera_pct: 7.3,
  },
  {
    govern: { principal: "ERC-AM", secundari: "Nom Cognom Cognom", color: "#ffb232" },
    mesvotada: { principal: "No", secundari: "la més votada va ser PSC-CP" },
    majoria: { principal: "No", secundari: "8 de 21; en calen 11" },
  },
  { deute_mandat: "de 120 € el 2023 a 172 € el 2025, amb ERC-AM a l'alcaldia", ibi: "última revisió cadastral: 2007" },
);

/** El poble on falta gairebé tot: és el cas que ha de parlar, no callar. */
const ABELLA = fila(
  "abella-de-la-conca",
  "Abella de la Conca",
  PETIT,
  {
    poblacio: 158, regidories: 5, participacio: 88.1, alternances: 0,
    deute: 0, deute_mandat: null, estalvi: null, saldo: null, carrega: null,
    execucio: null, pmp: null, ibi: null, selectiva: null, dones: 20, transparencia: null,
    cost_govern: 31.2, preu_aigua: null, rebut_ibi: null, renda: 11_800, estrangera_pct: 3.1,
  },
  {
    govern: { principal: "No consta", secundari: "" },
    mesvotada: { principal: "No consta", secundari: "" },
    majoria: { principal: "Sí", secundari: "5 de 5 regidories" },
  },
);

const pagina = (files: readonly ComparadorRow[]): string => renderComparador(files, "2026-08-29");

// ------------------------------------- el `<script>` de la pàgina, executat

type Fals = {
  innerHTML: string; textContent: string; hidden: boolean; disabled: boolean;
  value: string; children: unknown[];
  addEventListener(): void; setAttribute(): void; removeAttribute(): void;
  querySelector(): null; closest(): null;
};

function element(): Fals {
  return {
    innerHTML: "", textContent: "", hidden: false, disabled: false, value: "", children: [],
    addEventListener() {}, setAttribute() {}, removeAttribute() {},
    querySelector: () => null, closest: () => null,
  };
}

/**
 * Executa el `<script>` incrustat amb un DOM de mentida i torna els nodes.
 *
 * Sense això, un error del codi del navegador —una variable que no hi és, una
 * funció que ja no es diu igual— es publicaria sencer i només petaria a la
 * pàgina, en silenci i a casa de qui la llegeix. Aquí peta al test.
 */
function obre(html: string, slugs: readonly string[]): Record<string, Fals> {
  const script = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
  const nodes: Record<string, Fals> = {};
  const document = {
    getElementById(id: string): Fals {
      return (nodes[id] ??= element());
    },
    querySelectorAll: (): unknown[] => [],
  };
  const executa = new Function(
    "document",
    "location",
    "history",
    "window",
    `${script}\nreturn { afegeix: afegeix };`,
  ) as (
    d: unknown, l: unknown, h: unknown, w: unknown,
  ) => { afegeix(slug: string): void };

  const api = executa(
    document,
    { search: "", pathname: "/observatori/comparador/" },
    { replaceState() {} },
    { setTimeout() {} },
  );
  for (const slug of slugs) api.afegeix(slug);
  return nodes;
}

// --------------------------------------------------------------- els indicadors

describe("els indicadors que serveixen per jutjar una gestió", () => {
  const html = pagina([ESPLUGUES, SANT_JUST]);

  it("hi ha una secció que mira el temps i no l'últim any, i mira el mandat d'ara", () => {
    expect(html).toContain("Com ha anat el mandat");
    expect(html).toContain("Deute: del 2023 ençà");
    expect(html).not.toContain("Deute: del 2019 al 2023");
  });

  it("hi ha les cinc files noves, cadascuna a la seva secció", () => {
    expect(html).toContain("Què es paga");
    for (const etiqueta of [
      "Cost del govern per habitant", "Preu de l'aigua, €/m³", "Rebut mitjà de l'IBI",
      "Renda neta per persona", "Població de nacionalitat estrangera",
    ]) {
      expect(html).toContain(etiqueta);
    }
    // La renda ho diu: no la decideix l'ajuntament.
    expect(html).toContain("No ho decideix l'ajuntament");
  });

  it("cap capçalera de fila no diu «millor»: es marquen els extrems i la paritat diu l'objectiu", () => {
    const guio = html.slice(html.lastIndexOf("const XIFRES"), html.lastIndexOf("const TEXTOS"));
    expect(guio).not.toContain("millor");
    expect(guio).toContain("es marquen el més alt i el més baix");
    expect(guio).toContain("el 50 % és la paritat");
    expect(guio).toContain("es marquen la variació més alta i la variació més baixa");
    expect(guio).toContain('"com":"no es compara"');
  });

  it("hi ha els indicadors de competència executiva i de comptes que faltaven", () => {
    for (const etiqueta of [
      "Inversions executades", "Càrrega financera", "Saldo no financer", "Canvis de força més votada",
    ]) {
      expect(html).toContain(etiqueta);
    }
  });

  it("la nota de l'IBI ja no es disculpa d'una cosa que tenim resolta", () => {
    expect(html).not.toContain("que no són comparables entre municipis");
    expect(html).toContain("l'any de l'última revisió cadastral");
  });

  it("cada fila nova diu d'on surt", () => {
    // Sense el conjunt escrit, una fila nova és una xifra que ningú no pot anar
    // a comprovar. Les fonts noves: la liquidació i la sèrie electoral.
    expect(html).toContain("81f18313");
    expect(html).toContain("3539f7e6");
  });
});

// ----------------------------------------------------------------- la taula

describe("la taula pintada al navegador", () => {
  const cos = (files: readonly ComparadorRow[], slugs: readonly string[]): string =>
    obre(pagina(files), slugs)["cos-taula"]!.innerHTML;

  it("la variació del mandat surt amb signe, amb el peu i amb qui governa", () => {
    const html = cos([ESPLUGUES, SANT_JUST], ["esplugues-de-llobregat", "sant-just-desvern"]);
    expect(html).toContain("−47 €");
    expect(html).toContain("+52 €");
    expect(html).toContain("de 237 € el 2023 a 190 € el 2025, amb PSC-CP a l&quot;alcaldia".replace("&quot;", "'"));
  });

  it("la variació no reparteix bons i dolents: marca qui puja i qui baixa", () => {
    const html = cos([ESPLUGUES, SANT_JUST], ["esplugues-de-llobregat", "sant-just-desvern"]);
    // Baixar el deute pot ser no invertir, i pujar-lo pot ser construir una
    // escola: la fila marca els extrems i no reparteix bons ni dolents.
    const seccio = html.slice(html.indexOf("Deute: del 2023 ençà"));
    const mandat = seccio.slice(0, seccio.indexOf("</tr>"));
    expect(mandat).toContain("la variació més baixa");
    expect(mandat).toContain("la variació més alta");
    expect(mandat).not.toContain('class="marca millor"');
    expect(mandat).not.toContain('class="marca pitjor"');
  });

  it("cap fila no reparteix bons i dolents: ni marques ni fons de color", () => {
    // La metodologia mana: no hi posem cap veredicte. A la taula, el deute, la
    // participació i la paritat es marquen igual que l'IBI —el més alt i el
    // més baix— i cap casella no porta la classe que abans la pintava.
    const html = cos([ESPLUGUES, SANT_JUST], ["esplugues-de-llobregat", "sant-just-desvern"]);
    expect(html).not.toContain("millor");
    expect(html).not.toContain("pitjor");
    expect(html).not.toContain('<td class="millor"');
    expect(html).not.toContain('<td class="pitjor"');
    const deute = html.slice(html.indexOf("Deute per habitant"));
    const filaDeute = deute.slice(0, deute.indexOf("</tr>"));
    expect(filaDeute).toContain('<span class="marca alt">el més alt</span>');
    expect(filaDeute).toContain('<span class="marca baix">el més baix</span>');
    // I on no té sentit comparar —el cost del govern, la renda— no es marca res.
    const renda = html.slice(html.indexOf("Renda neta per persona"));
    expect(renda.slice(0, renda.indexOf("</tr>"))).not.toContain('class="marca');
  });

  it("el percentil porta el seu quint en tinta, de més clar a més fosc", () => {
    const html = cos([ESPLUGUES, SANT_JUST], ["esplugues-de-llobregat", "sant-just-desvern"]);
    // p42 és el tercer quint; p95, el cinquè; p4, el primer.
    expect(html).toContain('<i class="quintil q2" aria-hidden="true"></i>p42 entre els 88 municipis');
    expect(html).toContain('<i class="quintil q4" aria-hidden="true"></i>p95 entre els 88 municipis');
    expect(html).toContain('<i class="quintil q0" aria-hidden="true"></i>p4 entre els 88 municipis');
  });

  it("quan tots dos baixen el deute, cap dels dos no «puja»", () => {
    // Al mandat anterior, 401 dels 947 van baixar el deute: que dos municipis
    // triats baixin tots dos és el cas normal, no el rar. Dir-li «el que més
    // puja» al que baixa menys seria fals.
    const menys = { ...SANT_JUST, valors: { ...SANT_JUST.valors, deute_mandat: -12 } };
    const html = cos([ESPLUGUES, menys], ["esplugues-de-llobregat", "sant-just-desvern"]);
    const seccio = html.slice(html.indexOf("Deute: del 2023 ençà"));
    const mandat = seccio.slice(0, seccio.indexOf("</tr>"));
    expect(mandat).toContain("−47 €");
    expect(mandat).toContain("−12 €");
    expect(mandat).not.toContain("puja");
  });

  it("les xifres de l'Idescat porten el seu enllaç al costat, com demana la llicència", () => {
    const html = cos([ESPLUGUES, SANT_JUST], ["esplugues-de-llobregat", "sant-just-desvern"]);
    const enllac = '<a class="sec idescat" href="' + ENLLAC_IDESCAT + '" rel="noopener nofollow">Idescat</a>';
    const rebut = html.slice(html.indexOf("Rebut mitjà de l'IBI"));
    expect(rebut.slice(0, rebut.indexOf("</tr>"))).toContain("512 €</span>" + enllac);
    const estrangera = html.slice(html.indexOf("Població de nacionalitat estrangera"));
    expect(estrangera.slice(0, estrangera.indexOf("</tr>"))).toContain("11,8 %</span>" + enllac);
    // I les que no són de l'Idescat no en porten.
    const deute = html.slice(html.indexOf("Deute per habitant"));
    expect(deute.slice(0, deute.indexOf("</tr>"))).not.toContain("Idescat");
  });

  it("sense l'enllaç de l'Idescat, la seva xifra no es publica: la casella diu què falta", () => {
    const senseEnllac = fila(
      "sant-just-desvern", "Sant Just Desvern", GRAN, SANT_JUST.valors, SANT_JUST.textos, {}, null,
    );
    const html = cos([ESPLUGUES, senseEnllac], ["esplugues-de-llobregat", "sant-just-desvern"]);
    const rebut = html.slice(html.indexOf("Rebut mitjà de l'IBI"));
    const filaRebut = rebut.slice(0, rebut.indexOf("</tr>"));
    expect(filaRebut).toContain("512 €");
    expect(filaRebut).not.toContain("780 €");
    expect(filaRebut).toContain("No en tenim un rebut mitjà que es pugui publicar.");
    // Les xifres que no són de l'Idescat surten igual.
    expect(html).toContain("12,7 €");
  });

  it("l'any de la xifra va a la capçalera de la fila, i al peu només qui va d'un altre any", () => {
    const ambAnys = [
      { ...ESPLUGUES, anys: { cost_govern: 2024, renda: 2023 } },
      { ...SANT_JUST, anys: { cost_govern: 2023, renda: 2023 } },
      { ...ABELLA, anys: { cost_govern: 2024, renda: 2023 } },
    ];
    const pag = pagina(ambAnys);
    expect(pag).toContain("dada del 2024 · no es compara");
    const html = obre(pag, ["esplugues-de-llobregat", "sant-just-desvern"])["cos-taula"]!.innerHTML;
    const cost = html.slice(html.indexOf("Cost del govern per habitant"));
    const filaCost = cost.slice(0, cost.indexOf("</tr>"));
    // La capçalera de la fila porta l'any comú; les caselles, només qui no hi és.
    expect(filaCost).toContain('<span class="sentit">dada del 2024 · no es compara</span>');
    const caselles = filaCost.slice(filaCost.indexOf("</th>"));
    expect(caselles).toContain('12,7 €</span><span class="sec">dada del 2023</span>');
    expect(caselles).not.toContain("dada del 2024");
  });

  it("les sigles de qui governa hi són, amb el color del partit i portant a la seva pàgina", () => {
    const html = cos([ESPLUGUES, SANT_JUST], ["esplugues-de-llobregat", "sant-just-desvern"]);
    // Quan sabem de quin partit són, la pastilla és un enllaç a la seva pàgina;
    // el color continua sent el de la marca.
    expect(html).toContain('href="../partit/psc/" style="--c:#d00c3c;--t:#FBF7EE"');
    expect(html).toContain('href="../partit/erc/" style="--c:#ffb232;--t:#1E1B2E"');
    expect(html).toContain(">PSC-CP</a>");
  });

  it("qui governa va abans de les xifres que se li atribuiran", () => {
    const html = cos([ESPLUGUES, SANT_JUST], ["esplugues-de-llobregat", "sant-just-desvern"]);
    expect(html.indexOf("Qui governa")).toBeLessThan(html.indexOf("Participació el 2023"));
  });

  it("l'any de la revisió cadastral va al costat del tipus, no a una disculpa", () => {
    const html = cos([ESPLUGUES, SANT_JUST], ["esplugues-de-llobregat", "sant-just-desvern"]);
    expect(html).toContain("última revisió cadastral: 1990");
    expect(html).toContain("última revisió cadastral: 2007");
  });

  it("el percentil diu de quants municipis és el grup", () => {
    const html = cos([ESPLUGUES, SANT_JUST], ["esplugues-de-llobregat", "sant-just-desvern"]);
    expect(html).toContain("p42 entre els 88 municipis de la seva mida");
  });

  it("una casella buida diu què és el que ens falta", () => {
    const html = cos([ESPLUGUES, ABELLA], ["esplugues-de-llobregat", "abella-de-la-conca"]);
    expect(html).toContain("No en tenim la liquidació.");
    expect(html).toContain("No en tenim l&#039;ordenança fiscal.".replace("&#039;", "'"));
    expect(html).toContain("Encara no hi ha dos exercicis liquidats del mandat 2023-2027.");
    expect(html).toContain("No és a l'observatori del preu de l'aigua.");
    // El text vell no informava de res i és el que s'ha tret.
    expect(html).not.toContain(">sense dada<");
  });

  it("una casella de text sense dada tampoc no es queda muda", () => {
    const html = cos([ESPLUGUES, ABELLA], ["esplugues-de-llobregat", "abella-de-la-conca"]);
    expect(html).toContain("No en tenim l&#039;alcaldia.".replace("&#039;", "'"));
    expect(html).not.toContain(">No consta<");
  });

  it("«cap vegada» i «igual» no s'escriuen com un zero", () => {
    const html = cos([ESPLUGUES, ABELLA], ["esplugues-de-llobregat", "abella-de-la-conca"]);
    expect(html).toContain(">cap<");
    expect(html).toContain(">1 vegada<");
  });
});

// ------------------------------------------------------ el que avisa a dalt

describe("els avisos", () => {
  it("compta els forats de la comparació que s'està mirant", () => {
    const nodes = obre(pagina([ESPLUGUES, ABELLA]), ["esplugues-de-llobregat", "abella-de-la-conca"]);
    expect(nodes.buits!.hidden).toBe(false);
    // Abella no té deu xifres ni dues cel·les de text; Esplugues les té totes.
    expect(nodes.buits!.innerHTML).toContain("<b>12 caselles de 44</b> d'aquesta taula no tenen dada");
    expect(nodes.buits!.innerHTML).toContain("No vol dir que la xifra sigui zero");
  });

  it("una taula sense cap forat no s'inventa un avís", () => {
    const nodes = obre(pagina([ESPLUGUES, SANT_JUST]), ["esplugues-de-llobregat", "sant-just-desvern"]);
    expect(nodes.buits!.hidden).toBe(true);
  });

  it("comparar lligues diferents avisa a dalt, amb la mida de cada grup", () => {
    const nodes = obre(pagina([ESPLUGUES, ABELLA]), ["esplugues-de-llobregat", "abella-de-la-conca"]);
    expect(nodes.desigual!.hidden).toBe(false);
    expect(nodes.desigual!.innerHTML).toContain("No juguen a la mateixa lliga");
    expect(nodes.desigual!.innerHTML).toContain("Són 2 grups de comparació dels 2 que hi ha");
    expect(nodes.desigual!.innerHTML).toContain("de 20.001 a 50.000 habitants, 88 municipis");
    expect(nodes.desigual!.innerHTML).toContain("fins a 250 habitants, 45 municipis");
    // 47.182 contra 158 són dos mons: l'avís de població també ha de sortir.
    expect(nodes.desigual!.innerHTML).toContain("una ciutat presta serveis");
  });

  it("dins de la mateixa lliga no hi ha avís", () => {
    const nodes = obre(pagina([ESPLUGUES, SANT_JUST]), ["esplugues-de-llobregat", "sant-just-desvern"]);
    expect(nodes.desigual!.hidden).toBe(true);
  });

  it("la capçalera diu amb quants municipis es compara cada columna", () => {
    const nodes = obre(pagina([ESPLUGUES, ABELLA]), ["esplugues-de-llobregat", "abella-de-la-conca"]);
    expect(nodes["capcalera-taula"]!.innerHTML).toContain("es compara amb els 88 municipis de 20.001 a 50.000 habitants");
    expect(nodes["capcalera-taula"]!.innerHTML).toContain("es compara amb els 45 municipis fins a 250 habitants");
  });
});

// --------------------------------------------------------------- 320 píxels

describe("cap a 320 px", () => {
  const html = pagina([ESPLUGUES, SANT_JUST, ABELLA]);

  it("res de fora de la taula no té una amplada fixa que desbordi", () => {
    // La taula pot ser més ampla que la pantalla perquè viu dins d'un `.marc`
    // amb `overflow-x:auto`; la resta de la pàgina, no. Es busquen amplades
    // absolutes al CSS que no siguin d'un objectiu de toc.
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    // La condició d'un `@media` no és cap amplada de res: és el llindar a
    // partir del qual s'aplica un bloc, i un `@media (min-width:1180px)` deia
    // aquí que la pàgina desbordava quan el que fa és exactament el contrari.
    // Es treu la condició i es deixa el bloc, que sí que s'ha de mirar.
    const declaracions = css.replace(/@media[^{]*\{/g, "{");

    /*
     * Els contenidors que es desplacen ells sols no compten, i no és cap
     * excepció escrita a mà: es dedueixen del mateix full. Una taula de comptes
     * i un gràfic amb eix no poden cabre a 320 px sense fer-los il·legibles, i
     * la casa ja té la solució —`.marc`, `.taula-envolta`, `.grafic`—: el
     * contingut ample viu dins d'una caixa amb `overflow-x:auto` i és la caixa,
     * no la pàgina, la que s'arrossega. El que aquesta prova ha d'impedir és
     * una amplada fixa **fora** d'una caixa així, que és el que desplaça el
     * document sencer.
     */
    // Cap dels dos costats de la regla no pot dur claus: així el que es llegeix
    // com a selector és un selector i no la capçalera d'un `@media`, que és el
    // que passava quan el cos podia contenir-ne.
    const REGLA = /([^{}]*)\{([^{}]*)\}/g;
    const desplacables = [...css.matchAll(REGLA)]
      .filter((m) => /overflow-x:\s*auto/.test(m[2]!))
      .flatMap((m) => [...m[1]!.matchAll(/\.[A-Za-z0-9_-]+/g)].map((c) => c[0]!));
    expect(desplacables).toContain(".taula-envolta");

    // `max-width` és un sostre i no desborda mai; el que empeny la pàgina és
    // una amplada mínima o fixa. Són aquestes les que no poden passar de 320.
    const amples: number[] = [];
    for (const regla of declaracions.matchAll(REGLA)) {
      const selector = regla[1]!;
      if (desplacables.some((classe) => selector.includes(classe))) continue;
      for (const decl of regla[2]!.matchAll(/(?:^|[;{\s(])((?:min-)?width):\s*(\d+)px/g)) {
        amples.push(Number(decl[2]));
      }
    }
    expect(amples.length).toBeGreaterThan(0);
    for (const ample of amples) expect(ample).toBeLessThanOrEqual(320);
  });

  it("els textos llargs de les caselles noves es poden trencar", () => {
    // Un «No en tenim el deute del 2019 o del 2023.» amb `white-space:nowrap`
    // faria una columna de mig metre; unes sigles de coalició, també.
    expect(html).toContain(".comparativa .valor.sense{");
    expect(html).toContain("overflow-wrap:anywhere");
    expect(html).toContain(".comparativa .sigla{white-space:normal");
  });
});

// ------------------------------------------------ una pàgina per mirar-se-la

describe("la pàgina sencera", () => {
  it("es genera i es pot obrir", () => {
    const html = pagina([ESPLUGUES, SANT_JUST, ABELLA]);
    const fitxer = join(mkdtempSync(join(tmpdir(), "comparador-")), "index.html");
    writeFileSync(fitxer, html);
    expect(html).toContain("<!doctype html>");
    expect(html.length).toBeGreaterThan(10_000);
    // Es diu on ha anat: si el test es mira a mà, el fitxer és aquí.
    expect(fitxer).toContain("comparador-");
  });

  it("cap veredicte de gestió a la pàgina, i la pàgina ho diu", () => {
    const html = pagina([ESPLUGUES, SANT_JUST, ABELLA]);
    for (const paraula of ["ben gestionat", "mal gestionat", "bona gestió", "mala gestió", "aprovat", "suspens"]) {
      expect(html.toLowerCase()).not.toContain(paraula);
    }
    expect(html).toContain("No hi posem cap veredicte");
    // La llegenda de la taula ja no reparteix «millor» i «pitjor».
    const llegenda = html.slice(html.indexOf('id="llegenda"'), html.indexOf("</p>", html.indexOf('id="llegenda"')));
    expect(llegenda).not.toContain("illor");
    expect(llegenda).not.toContain("itjor");
    expect(llegenda).toContain("<b>El més alt</b> i <b>el més baix</b>");
  });
});
