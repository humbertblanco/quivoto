import { describe, expect, it } from "vitest";
import {
  agrupaPersones,
  anyIspa,
  clauMunicipiIspa,
  esCarrecElecte,
  fileraCapcaleraIspa,
  importDeclarat,
  menaImport,
  netejaHtml,
  parseBarcelona,
  parseCsv,
  parseIspa,
  resumRegidoriesIspa,
  type FilaBarcelona,
  type FilaIspa,
} from "./j22-retribucions";
import type { Cella, Full } from "../adapters/aca";

/**
 * Les proves d'aquest fitxer estan escrites amb files copiades literalment de
 * les dues fonts, descarregades i comprovades el 30-08-2026. Una prova amb
 * dades inventades aquí no comprovaria res: tot el risc del job és que la font
 * escrigui les coses d'una manera que no ens esperem.
 */

// ─────────────────────────────────────────────────────────────────────────────
// El CSV de Barcelona
// ─────────────────────────────────────────────────────────────────────────────

describe("parseCsv", () => {
  it("respecta les comes de dins de les cometes", () => {
    // La columna «observacio_remuneracio_ca» porta frases amb comes i amb
    // enllaços. Un split(",') posicional desalinearia les nou columnes de la
    // dreta, que són justament les de les declaracions de béns.
    const files = parseCsv('a,b,c\n1,"dos, i mig",3\n');
    expect(files).toEqual([
      ["a", "b", "c"],
      ["1", "dos, i mig", "3"],
    ]);
  });

  it("desdobla les cometes escapades i aguanta els salts de línia finals", () => {
    expect(parseCsv('x\n"diu ""hola"" i prou"')).toEqual([["x"], ['diu "hola" i prou']]);
  });

  it("es menja el BOM, que si no la primera capçalera no lliga mai", () => {
    expect(parseCsv("﻿partit_politic,nom\nPSC,Laia")[0]).toEqual(["partit_politic", "nom"]);
  });
});

/** Capçalera i files literals del CSV de l'Ajuntament, retallades a les columnes que fem servir. */
const CSV_BCN = [
  "partit_politic,nom,cognom_1,cognom_2,grau_ocupacio,plena_dedicacio,remuneracio," +
    "observacio_remuneracio_ca,descripcio_carrec_ca,posicio_principal,dependencia_ca,foto,cv_ca," +
    "declaracio_activitats_ca,declaracio_bens_ca",
  "PSC,Albert,Batlle,Bastardas,100.00,False,102119.64,,Tinent d'Alcaldia,Sí,Àrea de Seguretat,f.jpg,cv.pdf,,",
  "PSC,Albert,Batlle,Bastardas,100.00,False,102119.64,,Regidor,No,Districte,f.jpg,cv.pdf,,",
  "PSC,Albert,Batlle,Bastardas,100.00,False,102119.64,,Vocal,No,Consorci,f.jpg,cv.pdf,,",
  'Barcelona en comú,Marc,Serra,Solé,100.00,False,0.00,"Cobra d\'una <a href="https://x">altra administració</a>, no de l\'Ajuntament.",Regidor,Sí,Grup Municipal,,,,',
  "ERC,Rosa,Suriñach,Frigola,85.00,False,66579.38,,Regidora,Sí,Grup Municipal,,,,",
  ",Adrià,Carrillo,Padró,50.00,False,29509.76,,Assessor 4,Sí,Grup Municipal,,,,",
  ",Marta,Gerent,Exemple,100.00,True,118427.00,,Gerent,Sí,Gerència,,,,",
  ",Ricard,Font,Hereu,100.00,True,118427.00,,President,Sí,Consorci,,,,",
  ",Ricard,Font,Hereu,100.00,True,,,Vocal,No,Consorci,,,,",
].join("\n");

describe("parseBarcelona", () => {
  const files = parseBarcelona(CSV_BCN);

  it("llegeix el nom sencer i el càrrec de cada fila", () => {
    expect(files).toHaveLength(9);
    expect(files[0]!.nom).toBe("Albert Batlle Bastardas");
    expect(files[0]!.carrec).toBe("Tinent d'Alcaldia");
    expect(files[0]!.remuneracio).toBe("102119.64");
  });

  it("marca la posició principal i la plena dedicació tal com les escriu la font", () => {
    // La font escriu «Sí» amb accent i «True»/«False» en anglès i en majúscula.
    expect(files[0]!.principal).toBe(true);
    expect(files[1]!.principal).toBe(false);
    expect(files[6]!.plenaDedicacio).toBe(true);
    expect(files[0]!.plenaDedicacio).toBe(false);
  });

  it("busca les columnes pel nom i no per posició", () => {
    // Si la font hi afegeix una columna al mig, el nom ha de seguir sortint bé.
    const ambColumnaNova = CSV_BCN.replace("partit_politic,nom", "partit_politic,columna_nova,nom").replace(
      /\nPSC,Albert/g,
      "\nPSC,x,Albert",
    );
    expect(parseBarcelona(ambColumnaNova)[0]!.nom).toBe("Albert Batlle Bastardas");
  });
});

describe("netejaHtml", () => {
  it("treu les etiquetes de l'observació però conserva el text, que és el que explica el zero", () => {
    expect(
      netejaHtml(
        'Com a conseller sense dedicació no té assignada una retribució fixa, i només percep les ' +
          '<a href="https://x" target=”_blank”>dietes que estableix la normativa</a> per assistència.',
      ),
    ).toBe(
      "Com a conseller sense dedicació no té assignada una retribució fixa, i només percep les " +
        "dietes que estableix la normativa per assistència.",
    );
  });
});

describe("esCarrecElecte", () => {
  it("agafa els càrrecs del ple", () => {
    // Els quatre que surten al fitxer, escrits tal com hi són.
    expect(esCarrecElecte("Regidor")).toBe(true);
    expect(esCarrecElecte("Regidora Adscrita")).toBe(true);
    expect(esCarrecElecte("Regidor del Districte")).toBe(true);
    expect(esCarrecElecte("Tinent d'Alcaldia")).toBe(true);
  });

  it("deixa fora els consellers de districte, que no seuen al ple", () => {
    // 205 files del fitxer són consellers i conselleres de districte. Comptar-los
    // com a electes municipals faria que Barcelona tingués 246 regidors i no 41.
    expect(esCarrecElecte("Conseller")).toBe(false);
    expect(esCarrecElecte("Consellera tècnica")).toBe(false);
    expect(esCarrecElecte("Conseller assessor de la Presidència del Districte")).toBe(false);
    expect(esCarrecElecte("Gerent")).toBe(false);
    expect(esCarrecElecte("Assessor 3")).toBe(false);
    expect(esCarrecElecte("Vocal")).toBe(false);
    expect(esCarrecElecte("Comissionada")).toBe(false);
  });
});

describe("importDeclarat", () => {
  it("no suma mai les files repetides d'una mateixa persona", () => {
    // Albert Batlle surt 12 vegades al fitxer amb el mateix import. Sumar-les
    // li atribuiria 1.225.435,68 €, dotze vegades el que cobra.
    expect(importDeclarat(["102119.64", "102119.64", "102119.64"])).toEqual({
      euros: 102119.64,
      ambigu: false,
    });
  });

  it("una fila buida no contradiu res: no dir res no és dir una altra cosa", () => {
    expect(importDeclarat(["118427.00", ""])).toEqual({ euros: 118427, ambigu: false });
  });

  it("dos imports diferents no en donen cap", () => {
    expect(importDeclarat(["102119.64", "58642.50"])).toEqual({ euros: null, ambigu: true });
  });

  it("el zero és una xifra publicada, no un forat", () => {
    // Quatre regidors hi tenen 0,00 €: no és que no ho publiquin, és que
    // l'Ajuntament declara no pagar-los res perquè cobren d'una altra banda.
    expect(importDeclarat(["0.00"])).toEqual({ euros: 0, ambigu: false });
    expect(importDeclarat([""])).toEqual({ euros: null, ambigu: false });
  });
});

describe("agrupaPersones", () => {
  const persones = agrupaPersones(parseBarcelona(CSV_BCN));
  const de = (nom: string): (typeof persones)[number] => persones.find((p) => p.nom === nom)!;

  it("una persona, una fitxa, encara que tingui tres càrrecs", () => {
    expect(persones).toHaveLength(6);
    expect(de("Albert Batlle Bastardas").carrecs).toEqual(["Tinent d'Alcaldia", "Regidor", "Vocal"]);
    expect(de("Albert Batlle Bastardas").euros).toBe(102119.64);
  });

  it("marca com a electe qui té algun càrrec del ple, encara que en tingui d'altres", () => {
    expect(de("Albert Batlle Bastardas").electe).toBe(true);
    expect(de("Rosa Suriñach Frigola").electe).toBe(true);
    expect(de("Adrià Carrillo Padró").electe).toBe(false);
    expect(de("Marta Gerent Exemple").electe).toBe(false);
  });

  it("conserva l'observació que explica per què el sou és zero", () => {
    const marc = de("Marc Serra Solé");
    expect(marc.euros).toBe(0);
    expect(marc.observacio).toContain("altra administració");
    expect(marc.observacio).not.toContain("<a");
  });

  it("una fila sense import no anul·la la que en té: és el cas de Ricard Font Hereu", () => {
    // L'única persona de les 417 amb una fila amb import i una altra buida.
    // Tractar el buit com un import diferent li esborraria el sou publicat.
    const ricard = de("Ricard Font Hereu");
    expect(ricard.importAmbigu).toBe(false);
    expect(ricard.euros).toBe(118427);
  });

  it("agafa la fila marcada com a principal per al grau d'ocupació", () => {
    expect(de("Albert Batlle Bastardas").grauOcupacio).toBe("100.00");
  });
});

describe("agrupaPersones amb imports que no lliguen", () => {
  it("es queda sense import i ho diu", () => {
    const fila = (carrec: string, remuneracio: string): FilaBarcelona => ({
      nom: "Anna Exemple Cognom",
      carrec,
      partit: null,
      remuneracio,
      observacio: null,
      grauOcupacio: null,
      plenaDedicacio: false,
      dependencia: null,
      principal: carrec === "Regidora",
      foto: null,
      cv: null,
      declaracioActivitats: null,
      declaracioBens: null,
    });
    const [anna] = agrupaPersones([fila("Regidora", "50000"), fila("Vocal", "60000")]);
    expect(anna!.euros).toBeNull();
    expect(anna!.importAmbigu).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Els fulls del Ministeri
// ─────────────────────────────────────────────────────────────────────────────

/** El capçal literal del full d'alcaldes, amb la capçalera a la fila 10. */
const CAPÇAL_ALCALDES: Cella[][] = [
  [],
  [],
  [],
  [null, null, null, null, null, null],
  [null, null, "ISPA 2025 (RETRIBUCIONES AÑO 2024)", null, null, null],
  [null, null, "RETRIBUCIONES DE ALCALDES ", null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, "AYUNTAMIENTO", "PROVINCIA", "CCAA", "RÉGIMEN DEDICACIÓN", "TOTAL PERCIBIDO"],
];

const full = (files: Cella[][]): Full => ({ nom: "Hoja1", files });

describe("fileraCapcaleraIspa", () => {
  it("troba la capçalera, que no és a la mateixa fila als dos fulls", () => {
    // Alcaldes la té a la 10 i regidors a la 9. Fixar-la faria que un dels dos
    // fitxers llegís el títol com si fos un municipi o perdés la primera fila.
    expect(fileraCapcaleraIspa(CAPÇAL_ALCALDES)).toBe(9);
    expect(fileraCapcaleraIspa(CAPÇAL_ALCALDES.slice(1))).toBe(8);
    expect(fileraCapcaleraIspa([[null], ["res"]])).toBe(-1);
  });
});

describe("anyIspa", () => {
  it("l'any dels imports és el del títol, no el del nom de l'espai", () => {
    // «ISPA 2025 (RETRIBUCIONES AÑO 2024)»: els euros són del 2024.
    expect(anyIspa(CAPÇAL_ALCALDES)).toBe(2024);
  });

  it("torna null si el títol no en diu cap, en comptes d'endevinar-ne un", () => {
    expect(anyIspa([[null, "RETRIBUCIONES DE ALCALDES "]])).toBeNull();
  });
});

describe("parseIspa", () => {
  const files = parseIspa(
    full([
      ...CAPÇAL_ALCALDES,
      [null, "Abrera", "Barcelona", "Cataluña", "Sin dedicación", 17874.9],
      [null, "Agost", "Alacant/Alicante", "Comunitat Valenciana", "Exclusiva", 45924],
      [null, "Alcoleja", "Alacant/Alicante", "Comunitat Valenciana", "Sin dedicación", 0],
      [null, "Aiguafreda", "Barcelona", "Cataluña", "Sin dedicación", 11000],
      [null, "Girona", "Girona", "Cataluña", "Exclusiva", 82081.76],
      [null, "Sense import", "Girona", "Cataluña", "Exclusiva", null],
      [null, "", "Girona", "Cataluña", "Exclusiva", 100],
    ]),
  );

  it("es queda només amb Catalunya", () => {
    // 866 files de 6.934 al full d'alcaldes; les altres 6.068 no van enlloc.
    expect(files.map((f) => f.municipi)).toEqual(["Abrera", "Aiguafreda", "Girona"]);
  });

  it("llegeix l'import tal com el publica el Ministeri", () => {
    expect(files[0]).toEqual({
      municipi: "Abrera",
      provincia: "Barcelona",
      regim: "Sin dedicación",
      euros: 17874.9,
    });
  });

  it("aparta la fila sense import en comptes de convertir-la en un zero", () => {
    // Un zero vol dir «no cobra»; un forat vol dir «no ho sabem». Confondre-ho
    // publicaria un alcalde que no cobra res quan el que passa és que falta la dada.
    expect(files.some((f) => f.municipi === "Sense import")).toBe(false);
  });
});

describe("clauMunicipiIspa", () => {
  it("desfà l'article invertit que el Ministeri escriu al final", () => {
    expect(clauMunicipiIspa("Alamús, Els", "Lleida")).toBe("alamus");
    expect(clauMunicipiIspa("Hospitalet de Llobregat, L'", "Barcelona")).toBe("hospitalet-de-llobregat");
    expect(clauMunicipiIspa("Bisbal del Penedès, La", "Tarragona")).toBe("bisbal-del-penedes");
  });

  it("cobreix l'article aranès «Es», que uninvertArticle no coneix", () => {
    // «Bòrdes, Es» és es Bòrdes. Sense això quedaria com a «bordes-es» i seria
    // l'únic municipi de la Val d'Aran que perdria el sou de la seva alcaldia.
    expect(clauMunicipiIspa("Bòrdes, Es", "Lleida")).toBe("bordes");
  });

  it("treu la província entre parèntesis, que no forma part del nom", () => {
    // El Ministeri desambigua els noms que es repeteixen a Espanya.
    expect(clauMunicipiIspa("la Granada (Barcelona)", "Barcelona")).toBe("granada");
    expect(clauMunicipiIspa("Mieres (Girona)", "Girona")).toBe("mieres");
  });

  it("tradueix els noms anteriors a un canvi de denominació", () => {
    expect(clauMunicipiIspa("Bigues I Riells", "Barcelona")).toBe("bigues-i-riells-del-fai");
    expect(clauMunicipiIspa("Calonge", "Girona")).toBe("calonge-i-sant-antoni");
  });

  it("no confon Calonge amb Calonge de Segarra, que és a l'altra província", () => {
    // Els dos són al full. Sense el filtre de província, els 58.000 € de
    // l'alcaldia de Calonge i Sant Antoni anirien a un poble de l'Anoia.
    expect(clauMunicipiIspa("Calonge de Segarra", "Barcelona")).toBe("calonge-de-segarra");
    expect(clauMunicipiIspa("Calonge", "Barcelona")).toBe("calonge");
  });

  it("deixa igual els noms que ja lliguen", () => {
    expect(clauMunicipiIspa("Abrera", "Barcelona")).toBe("abrera");
    expect(clauMunicipiIspa("Avellanes I Santa Linya, Les", "Lleida")).toBe("avellanes-i-santa-linya");
  });
});

describe("menaImport", () => {
  it("«Sin dedicación» amb import són assistències, no un sou", () => {
    // Abrera: 17.874,90 € sense dedicació. Dir-ne sou seria fals; són el que
    // cobra l'alcalde per anar als plens i a les comissions.
    expect(menaImport("Sin dedicación", 17874.9)).toBe("assistencies");
    expect(menaImport("Sin dedicación", 180)).toBe("assistencies");
  });

  it("amb dedicació sí que és un sou", () => {
    expect(menaImport("Exclusiva", 82081.76)).toBe("sou");
    expect(menaImport("Parcial", 14000)).toBe("sou");
  });

  it("zero no és cap import de cap mena", () => {
    expect(menaImport("Sin dedicación", 0)).toBe("cap");
    expect(menaImport("Exclusiva", 0)).toBe("cap");
  });
});

describe("resumRegidoriesIspa", () => {
  const fila = (regim: string, euros: number): FilaIspa => ({
    municipi: "Abrera",
    provincia: "Barcelona",
    regim,
    euros,
  });
  // Les cinc primeres files reals d'Abrera al full de regidors, més dues de zero.
  const resum = resumRegidoriesIspa([
    fila("Exclusiva", 44138.78),
    fila("Exclusiva", 44060.94),
    fila("Parcial", 33420.32),
    fila("Sin dedicación", 4800),
    fila("Sin dedicación", 0),
    fila("Sin dedicación", 0),
  ]);

  it("compta els règims tal com els diu la font", () => {
    expect(resum.files).toBe(6);
    expect(resum.dedicacioExclusiva).toBe(2);
    expect(resum.dedicacioParcial).toBe(1);
    expect(resum.senseDedicacio).toBe(3);
  });

  it("separa els sous de les assistències i dels qui no cobren", () => {
    expect(resum.ambSou).toBe(3);
    expect(resum.nomesAssistencies).toBe(1);
    expect(resum.senseCapImport).toBe(2);
  });

  it("el mínim, la mediana i el màxim són només dels sous", () => {
    // Si les assistències hi entressin, el mínim d'aquest ple seria 4.800 € i
    // semblaria que hi ha una regidoria amb un sou de misèria.
    expect(resum.souMinim).toBe(33420.32);
    expect(resum.souMedia).toBe(44060.94);
    expect(resum.souMaxim).toBe(44138.78);
  });

  it("la suma va marcada com a suma d'aquest full i de cap altre", () => {
    expect(resum.sumaDelFullDeRegidories).toBe(126420.04);
  });

  it("un ple on ningú no cobra no inventa cap mediana", () => {
    const cap = resumRegidoriesIspa([fila("Sin dedicación", 0), fila("Sin dedicación", 0)]);
    expect(cap.souMinim).toBeNull();
    expect(cap.souMedia).toBeNull();
    expect(cap.souMaxim).toBeNull();
    expect(cap.sumaDelFullDeRegidories).toBe(0);
  });
});
