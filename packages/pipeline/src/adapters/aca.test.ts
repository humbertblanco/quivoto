import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  dataDeSerie,
  dataRevisioAca,
  desescapaXml,
  fileraCapcalera,
  indexColumna,
  llegeixLlibre,
  llegeixZip,
  mapaColumnes,
  nombreAca,
  parseCadenes,
  parseFull,
  parseFullAca,
  parseLlibreAca,
  parseNotaAca,
  tarifaSocialAca,
  type Cella,
  type Full,
} from "./aca";

/**
 * Un ZIP mínim escrit aquí mateix, per no haver de desar cap `.xlsx` de 950 KB
 * al repositori. Cada entrada es desa comprimida o tal qual segons el que digui
 * `desa`, perquè el lector ha de saber llegir les dues coses: l'`.xlsx` de l'ACA
 * ve tot comprimit, però Excel desa sense comprimir els fitxers que ja ho estan.
 *
 * El CRC va a zero a posta: el lector no el comprova —si les dades no fossin
 * bones, el `inflate` ja peta— i així el fixture no depèn de calcular-lo.
 */
function creaZip(entrades: readonly { nom: string; contingut: string; desa?: "cru" | "deflate" }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let desplacament = 0;

  for (const entrada of entrades) {
    const cru = Buffer.from(entrada.contingut, "utf8");
    const metode = entrada.desa === "cru" ? 0 : 8;
    const dades = metode === 0 ? cru : deflateRawSync(cru);
    const nom = Buffer.from(entrada.nom, "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(metode, 8);
    local.writeUInt32LE(dades.length, 18);
    local.writeUInt32LE(cru.length, 22);
    local.writeUInt16LE(nom.length, 26);
    locals.push(local, nom, dades);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(metode, 10);
    central.writeUInt32LE(dades.length, 20);
    central.writeUInt32LE(cru.length, 24);
    central.writeUInt16LE(nom.length, 28);
    central.writeUInt32LE(desplacament, 42);
    centrals.push(central, nom);

    desplacament += 30 + nom.length + dades.length;
  }

  const directori = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entrades.length, 8);
  eocd.writeUInt16LE(entrades.length, 10);
  eocd.writeUInt32LE(directori.length, 12);
  eocd.writeUInt32LE(desplacament, 16);
  return Buffer.concat([...locals, directori, eocd]);
}

describe("llegeixZip", () => {
  it("llegeix les entrades comprimides i les que no ho estan", () => {
    const zip = creaZip([
      { nom: "xl/workbook.xml", contingut: "<workbook/>" },
      { nom: "xl/media/imatge.png", contingut: "no comprimit", desa: "cru" },
    ]);
    const fitxers = llegeixZip(zip);
    expect([...fitxers.keys()]).toEqual(["xl/workbook.xml", "xl/media/imatge.png"]);
    expect(fitxers.get("xl/workbook.xml")!.toString("utf8")).toBe("<workbook/>");
    expect(fitxers.get("xl/media/imatge.png")!.toString("utf8")).toBe("no comprimit");
  });

  it("no es deixa enredar per un fitxer que no és un ZIP", () => {
    expect(() => llegeixZip(Buffer.from("això no és cap ZIP, són dades HTML d'error"))).toThrow(/ZIP/);
  });
});

// El full de càlcul més petit que encara és un `.xlsx` de veritat: dos fulls,
// cadenes compartides, una data com a nombre de sèrie i un forat al mig.
const XLSX_MINIM = creaZip([
  {
    nom: "xl/workbook.xml",
    contingut:
      '<workbook><sheets><sheet name="Nota" sheetId="1" r:id="rId1"/>' +
      '<sheet name="2025" sheetId="2" r:id="rId2"/></sheets></workbook>',
  },
  {
    nom: "xl/_rels/workbook.xml.rels",
    contingut:
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Target="worksheets/sheet2.xml"/>' +
      '<Relationship Id="rId3" Target="styles.xml"/></Relationships>',
  },
  {
    nom: "xl/sharedStrings.xml",
    contingut:
      "<sst><si><t>Data d'actualització de les dades:</t></si><si><t>Font:</t></si>" +
      "<si><t>Agència Catalana de l'Aigua (ACA)</t></si><si><t>Idescat</t></si>" +
      "<si><t>Municipi</t></si><si><t>Subministrament\n€/m³</t></si>" +
      "<si><t>Cànon de l'aigua\n€/m³</t></si><si><t>Clavegueram\n€/m³</t></si>" +
      "<si><t>TOTAL\n€/m³</t></si><si><t>Gestió Subministrament</t></si>" +
      "<si><t>Tarifes socials</t></si><si><t>Data revisió</t></si>" +
      "<si><t>081878</t></si><si><r><t>Sab</t></r><r><t>adell</t></r></si>" +
      "<si><t>Indirecta</t></si><si><t>Si</t></si></sst>",
  },
  {
    nom: "xl/worksheets/sheet1.xml",
    contingut:
      '<worksheet><sheetData><row r="3"><c r="A3" t="s"><v>0</v></c><c r="B3" s="1"><v>45849</v></c></row>' +
      '<row r="4"><c r="A4" t="s"><v>1</v></c><c r="B4" t="s"><v>2</v></c></row></sheetData></worksheet>',
  },
  {
    nom: "xl/worksheets/sheet2.xml",
    contingut:
      '<worksheet><sheetData>' +
      '<row r="9"><c r="A9" t="s"><v>3</v></c><c r="B9" t="s"><v>4</v></c><c r="C9" t="s"><v>5</v></c>' +
      '<c r="D9" t="s"><v>6</v></c><c r="E9" t="s"><v>7</v></c><c r="F9" t="s"><v>8</v></c>' +
      '<c r="G9" t="s"><v>9</v></c><c r="H9" t="s"><v>10</v></c><c r="I9" t="s"><v>11</v></c></row>' +
      '<row r="10"><c r="A10" t="s"><v>12</v></c><c r="B10" t="s"><v>13</v></c><c r="C10"><v>1.5</v></c>' +
      '<c r="D10"><v>0.654</v></c><c r="E10"><v>0</v></c><c r="F10"><v>2.154</v></c>' +
      '<c r="G10" t="s"><v>14</v></c><c r="H10" t="s"><v>15</v></c><c r="I10"><v>45491</v></c></row>' +
      "</sheetData></worksheet>",
  },
]);

describe("llegeixLlibre", () => {
  const fulls = llegeixLlibre(XLSX_MINIM);

  it("torna els fulls amb el nom de la pestanya i en ordre", () => {
    expect(fulls.map((f) => f.nom)).toEqual(["Nota", "2025"]);
  });

  it("resol les cadenes compartides, també les que van partides en trossos", () => {
    // Excel parteix el text en `<r>` quan hi ha canvis de format enmig: si no
    // s'ajuntessin, «Sabadell» es llegiria com a «Sab».
    expect(fulls[1]!.files[9]![1]).toBe("Sabadell");
  });

  it("respecta el número de fila: la capçalera de l'ACA és la novena", () => {
    expect(fulls[1]!.files[8]![0]).toBe("Idescat");
    expect(fulls[1]!.files[0]).toEqual([]);
  });
});

describe("parseFull", () => {
  it("deixa un forat on l'XML no escriu la cel·la", () => {
    // Aquest és el cas que ho trencaria tot en silenci: l'XML només escriu les
    // cel·les amb contingut, i si les que falten no s'omplissin, la columna del
    // cànon aniria a parar a la del clavegueram.
    const full = parseFull(
      '<row r="1"><c r="A1"><v>1</v></c><c r="C1"><v>3</v></c></row>',
      [],
      "prova",
    );
    expect(full.files[0]).toEqual([1, null, 3]);
  });

  it("no publica el text d'una cel·la amb error", () => {
    const full = parseFull('<row r="1"><c r="A1" t="e"><v>#DIV/0!</v></c></row>', [], "prova");
    expect(full.files[0]![0]).toBeNull();
  });
});

describe("parseCadenes", () => {
  it("ajunta els trossos d'una cadena amb format i desescapa l'XML", () => {
    expect(parseCadenes("<sst><si><r><t>Sant </t></r><r><t>Just &amp; Co</t></r></si></sst>")).toEqual([
      "Sant Just & Co",
    ]);
  });
});

describe("desescapaXml", () => {
  it("desfà les entitats i els codis numèrics", () => {
    expect(desescapaXml("A &amp; B &lt;c&gt; &#8364; &#x20AC;")).toBe("A & B <c> € €");
  });
});

describe("indexColumna", () => {
  it("passa de la referència a l'índex", () => {
    expect(indexColumna("A1")).toBe(0);
    expect(indexColumna("M10")).toBe(12);
    expect(indexColumna("AA3")).toBe(26);
  });
});

describe("dataDeSerie", () => {
  it("converteix el nombre de dies d'Excel en data", () => {
    // Comprovats contra el full de l'ACA: la revisió d'Abella de la Conca i la
    // d'Abrera del 2025.
    expect(dataDeSerie(44635)).toBe("2022-03-15");
    expect(dataDeSerie(45742)).toBe("2025-03-26");
  });

  it("no es creu les dates que cauen al forat del 1900", () => {
    expect(dataDeSerie(59)).toBeNull();
    expect(dataDeSerie(0)).toBeNull();
  });
});

describe("nombreAca", () => {
  it("distingeix zero de «no ho sabem»", () => {
    // Aquesta és la diferència que decideix si un municipi baixa la mediana de
    // tot Catalunya o no hi entra: el full escriu text quan no hi ha xifra.
    expect(nombreAca(0)).toBe(0);
    expect(nombreAca("s. d.")).toBeNull();
    expect(nombreAca("Base imposable: Valor Cadastral")).toBeNull();
    expect(nombreAca("-")).toBeNull();
    expect(nombreAca("")).toBeNull();
    expect(nombreAca(null)).toBeNull();
  });

  it("llegeix els números escrits com a text", () => {
    expect(nombreAca("1,234")).toBe(1.234);
    expect(nombreAca(" 0.742 ")).toBe(0.742);
  });
});

describe("tarifaSocialAca", () => {
  it("una casella buida no és un «no»", () => {
    // El full no defineix enlloc què vol dir la casella buida: pot ser que el
    // municipi no en tingui o que l'ACA no ho sàpiga. Publicar-ho com a «no en
    // té» seria acusar 544 ajuntaments d'una cosa que la font no diu.
    expect(tarifaSocialAca("")).toBeNull();
    expect(tarifaSocialAca("   ")).toBeNull();
    expect(tarifaSocialAca(null)).toBeNull();
  });

  it("accepta les dues maneres com l'origen escriu que sí", () => {
    expect(tarifaSocialAca("Si")).toBe(true);
    expect(tarifaSocialAca("si")).toBe(true);
    expect(tarifaSocialAca("Sí")).toBe(true);
  });
});

describe("dataRevisioAca", () => {
  it("accepta el nombre de sèrie i el text", () => {
    expect(dataRevisioAca(45491)).toBe("2024-07-18");
    expect(dataRevisioAca("9/5/2023")).toBe("2023-05-09");
    expect(dataRevisioAca("2023-05-09")).toBe("2023-05-09");
    expect(dataRevisioAca("")).toBeNull();
  });
});

describe("mapaColumnes", () => {
  const capcalera2025: Cella[] = [
    "Idescat", "Municipi", "Comarca", "Subministrament\n€/m³", "Cànon de l'aigua\n€/m³",
    "Clavegueram\n€/m³", "TOTAL\n€/m³", "Entitat gestora principal\nSubministrament",
    "Gestió Subministrament", "Gestió Clavegueram", "(*)", "Tarifes socials", "Data revisió", null,
  ];

  it("troba cada columna pel nom, no per la posició", () => {
    expect(mapaColumnes(capcalera2025)).toEqual({
      idescat: 0, municipi: 1, comarca: 2, subministrament: 3, canon: 4, clavegueram: 5,
      total: 6, gestora: 7, gestioSubministrament: 8, gestioClavegueram: 9, asterisc: 10,
      tarifaSocial: 11, dataRevisio: 12,
    });
  });

  it("no confon «Gestió Clavegueram» amb el preu del clavegueram", () => {
    const mapa = mapaColumnes(capcalera2025);
    expect(mapa.clavegueram).toBe(5);
    expect(mapa.gestioClavegueram).toBe(9);
  });

  it("aguanta els fulls vells, que tenen la meitat de columnes", () => {
    // El full del 2015 no porta ni entitat gestora, ni tarifes socials, ni data
    // de revisió: llegir per índex fix trencaria la sèrie cada cop que l'ACA
    // n'afegeix una.
    const mapa = mapaColumnes([
      "Idescat", "Municipi", "Comarca", "Subministrament\n€/m³", "Cànon de l'aigua\n€/m³",
      "Clavegueram\n€/m³", "TOTAL\n€/m³",
    ]);
    expect(mapa.total).toBe(6);
    expect(mapa.dataRevisio).toBeUndefined();
    expect(mapa.tarifaSocial).toBeUndefined();
  });
});

const full = (files: Cella[][], nom = "2025"): Full => ({ nom, files });

describe("parseFullAca", () => {
  const files = parseFullAca(
    full([
      ["Preu de l'aigua per municipi vigent a 1 de gener de 2025"],
      [],
      [
        "Idescat", "Municipi", "Comarca", "Subministrament\n€/m³", "Cànon de l'aigua\n€/m³",
        "Clavegueram\n€/m³", "TOTAL\n€/m³", "Entitat gestora principal\nSubministrament",
        "Gestió Subministrament", "Gestió Clavegueram", "(*)", "Tarifes socials", "Data revisió",
      ],
      ["081878", "Sabadell", "Vallès Occidental", 1.5, 0.654, 0, 2.154, "Companyia D'Aigües De Sabadell, Sa", "Indirecta", "Indirecta", "", "Si", 45491],
      ["80018", "Abrera", "Baix Llobregat", 0.742, 0.654, 0, 1.396, "Ajuntament D'Abrera", "Directa", "Directa", "", "", 45742],
      ["170792", "Girona", "Gironès", 0.42, 0.654, 0.117, 1.191, "Cicle De L'Aigua Del Ter, Sa", "Directa", "Directa", "*", "Si", 45055],
      ["431714", "Tarragona", "Tarragonès", 1.2, 0.654, "Base imposable: Valor Cadastral", 1.854, "Ematsa", "Indirecta", "Directa", "", "Si", 45491],
      ["Font: ACA", null, null, null],
    ]),
  );

  it("llegeix només les files que porten codi de municipi", () => {
    expect(files.map((f) => f.municipi)).toEqual(["Sabadell", "Abrera", "Girona", "Tarragona"]);
  });

  it("reomple el zero inicial del codi Idescat", () => {
    // Si l'ACA desés el codi com a número, els 311 municipis de la província de
    // Barcelona perdrien el zero i deixarien de lligar amb el padró.
    expect(files[1]!.idescat6).toBe("080018");
  });

  it("guarda per què no hi ha preu de clavegueram quan no n'hi ha", () => {
    expect(files[3]!.clavegueram).toBeNull();
    expect(files[3]!.clavegueramNota).toBe("Base imposable: Valor Cadastral");
    expect(files[0]!.clavegueram).toBe(0);
    expect(files[0]!.clavegueramNota).toBeNull();
  });

  it("llegeix la data de revisió, la tarifa social i l'asterisc del comptador", () => {
    expect(files[0]!.dataRevisio).toBe("2024-07-18");
    expect(files[0]!.tarifaSocial).toBe(true);
    expect(files[1]!.tarifaSocial).toBeNull();
    expect(files[2]!.quotaComptadorApart).toBe(true);
    expect(files[0]!.quotaComptadorApart).toBe(false);
  });
});

describe("fileraCapcalera", () => {
  it("troba la fila de columnes encara que canviï de lloc", () => {
    expect(fileraCapcalera([["títol"], [], ["Idescat", "Municipi"]])).toBe(2);
    expect(fileraCapcalera([["títol"], []])).toBe(-1);
  });
});

describe("parseNotaAca", () => {
  it("treu la data d'actualització i el peu de font, que la llicència obliga a publicar", () => {
    expect(
      parseNotaAca(
        full(
          [
            ["Preu de l'aigua per municipi vigent a 1 de gener, període 2015 - 2025"],
            ["Data d'actualització de les dades:", 45849],
            ["Font:", "Agència Catalana de l'Aigua (ACA). Elaboració pròpia…"],
          ],
          "Nota",
        ),
      ),
    ).toEqual({
      dataActualitzacio: "2025-07-11",
      font: "Agència Catalana de l'Aigua (ACA). Elaboració pròpia…",
    });
  });

  it("no s'inventa res si el full «Nota» no hi és", () => {
    expect(parseNotaAca(undefined)).toEqual({ dataActualitzacio: null, font: null });
  });
});

describe("parseLlibreAca", () => {
  it("agafa els fulls que són un any i deixa la resta", () => {
    const preus = parseLlibreAca(llegeixLlibre(XLSX_MINIM));
    expect(preus.anys.map((a) => a.any)).toEqual([2025]);
    expect(preus.dataActualitzacio).toBe("2025-07-11");
    expect(preus.font).toBe("Agència Catalana de l'Aigua (ACA)");
    expect(preus.anys[0]!.files[0]).toMatchObject({
      idescat6: "081878",
      municipi: "Sabadell",
      subministrament: 1.5,
      canon: 0.654,
      clavegueram: 0,
      total: 2.154,
      tarifaSocial: true,
      dataRevisio: "2024-07-18",
    });
  });
});
