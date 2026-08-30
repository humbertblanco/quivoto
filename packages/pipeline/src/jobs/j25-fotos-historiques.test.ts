import { describe, expect, it } from "vitest";
import { normalizePersonName } from "../lib/text";
import {
  CONSULTA_RETRATS,
  alcaldesDiferents,
  aparellaRetrat,
  camiPublicHistoric,
  fitxaRetrats,
  idDeQid,
  llegeixRetrats,
  parseRetrats,
  trossos,
  urlCommonsRetrats,
  veredicteRetrat,
  type PersonaAmbRetrat,
  type RetratDesat,
} from "./j25-fotos-historiques";

/**
 * Les proves d'aquesta feina van gairebé totes sobre la llicència i sobre
 * l'aparellament, que són les dues coses que, si fallen, no es veuen: una cara
 * publicada sense permís i una cara al costat del nom equivocat surten
 * exactament igual de boniques a la fitxa.
 */

// ─────────────────────────────────────────────────────────────────────────────
// La consulta
// ─────────────────────────────────────────────────────────────────────────────

describe("CONSULTA_RETRATS", () => {
  /**
   * P18 no va dins d'OPTIONAL a posta: aquesta feina no té res a fer amb una
   * persona sense fotografia, i portar-se les 2.921 faria la resposta deu
   * vegades més grossa per llençar-ne el 88 %.
   */
  it("exigeix la fotografia i no la demana com a opcional", () => {
    expect(CONSULTA_RETRATS).toContain("?persona wdt:P18 ?imatge .");
    expect(CONSULTA_RETRATS).not.toContain("OPTIONAL { ?persona wdt:P18");
  });

  /** La mateixa definició d'alcaldia que J21, o els dos recomptes no lligarien. */
  it("fa servir la definició d'alcaldia de J21", () => {
    expect(CONSULTA_RETRATS).toContain("wd:Q5663900");
    expect(CONSULTA_RETRATS).toContain("wdt:P31 wd:Q33146843");
    expect(CONSULTA_RETRATS).toContain("YEAR(?inici) >= 1979");
  });

  /** La data de fi sí que és opcional: els mandats en curs no en tenen. */
  it("deixa passar els mandats que encara duren", () => {
    expect(CONSULTA_RETRATS).toContain("OPTIONAL { ?mandat pq:P582 ?fi }");
  });
});

describe("urlCommonsRetrats", () => {
  /**
   * Dues metadades més que J20, i totes dues fan falta: sense la categoria i
   * sense la citació no es pot distingir una plantilla d'atribució revisada per
   * Commons d'un fitxer al qual només li falta la llicència.
   */
  it("demana la categoria i la citació, que són el que decideix els 117", () => {
    const url = urlCommonsRetrats(["File:Un.jpg", "File:Dos.jpg"]);
    expect(decodeURIComponent(url)).toContain("Attribution");
    expect(decodeURIComponent(url)).toContain("Categories");
    expect(decodeURIComponent(url)).toContain("File:Un.jpg|File:Dos.jpg");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lectura de SPARQL
// ─────────────────────────────────────────────────────────────────────────────

const binding = (
  qid: string,
  nom: string,
  ine: string,
  municipi: string,
  inici: string,
  imatge: string,
  fi?: string,
) => ({
  persona: { value: `http://www.wikidata.org/entity/${qid}` },
  nom: { value: nom },
  ine: { value: ine },
  municipi: { value: municipi },
  inici: { value: inici },
  ...(fi === undefined ? {} : { fi: { value: fi } }),
  imatge: { value: `http://commons.wikimedia.org/wiki/Special:FilePath/${imatge}` },
});

const resposta = (bindings: unknown[]) => ({ results: { bindings } });

describe("parseRetrats", () => {
  it("llegeix el QID, el nom, l'INE i el fitxer de Commons", () => {
    const [persona] = parseRetrats(
      resposta([
        binding("Q123", "Antoni Siurana", "25120", "Lleida", "1989-06-17T00:00:00Z", "Antoni%20Siurana.jpg", "2003-06-14T00:00:00Z"),
      ]),
    );
    expect(persona!.qid).toBe("Q123");
    expect(persona!.nom).toBe("Antoni Siurana");
    expect(persona!.fitxer).toBe("File:Antoni Siurana.jpg");
    expect(persona!.mandats).toEqual([
      { ine5: "25120", municipi: "Lleida", inici: "1989-06-17", fi: "2003-06-14" },
    ]);
  });

  /**
   * Els municipis de menys de 10.000 habitants comencen per zero i qualsevol pas
   * per un número se'l menjaria: Abrera (08001) passaria a ser el 8001, que no
   * és de ningú.
   */
  it("conserva el zero del davant del codi INE", () => {
    const [persona] = parseRetrats(
      resposta([binding("Q1", "Algú", "8001", "Abrera", "1999-07-03T00:00:00Z", "Foto.jpg")]),
    );
    expect(persona!.mandats[0]!.ine5).toBe("08001");
  });

  /**
   * Dues persones porten dues imatges a P18. Si es desessin totes dues, la
   * mateixa persona sortiria dues vegades a la fitxa del seu poble.
   */
  it("es queda una sola imatge per persona", () => {
    const persones = parseRetrats(
      resposta([
        binding("Q1", "Algú", "08001", "Abrera", "1999-07-03T00:00:00Z", "Primera.jpg"),
        binding("Q1", "Algú", "08001", "Abrera", "1999-07-03T00:00:00Z", "Segona.jpg"),
      ]),
    );
    expect(persones).toHaveLength(1);
    expect(persones[0]!.fitxer).toBe("File:Primera.jpg");
    expect(persones[0]!.mandats).toHaveLength(1);
  });

  /** Qui ha estat alcalde de dos pobles ha de sortir a les dues fitxes. */
  it("guarda tots els municipis d'una mateixa persona, ordenats per data", () => {
    const [persona] = parseRetrats(
      resposta([
        binding("Q1", "Algú", "08019", "Barcelona", "2011-07-01T00:00:00Z", "Foto.jpg"),
        binding("Q1", "Algú", "08001", "Abrera", "1999-07-03T00:00:00Z", "Foto.jpg"),
      ]),
    );
    expect(persona!.mandats.map((m) => m.ine5)).toEqual(["08001", "08019"]);
  });

  /**
   * Sense QID, sense nom, sense INE, sense data d'inici o sense fitxer no hi ha
   * ni cara ni a qui posar-la: la fila no serveix i no s'hi inventa cap valor.
   */
  it("descarta les files a les quals els falta alguna cosa", () => {
    expect(parseRetrats(resposta([{ nom: { value: "Sense QID" } }]))).toEqual([]);
    expect(parseRetrats(resposta([]))).toEqual([]);
    expect(parseRetrats(null)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// L'aparellament
// ─────────────────────────────────────────────────────────────────────────────

const persona = (nom: string, mandats: PersonaAmbRetrat["mandats"]): PersonaAmbRetrat => ({
  qid: "Q1",
  nom,
  // El mateix normalitzador que fa servir la feina: escriure'n una còpia aquí
  // faria que la prova passés amb una regla i el codi fes servir una altra.
  nomNormalitzat: normalizePersonName(nom),
  fitxer: "File:Foto.jpg",
  mandats,
});

describe("aparellaRetrat", () => {
  const mandats = [{ ine5: "08001", municipi: "Abrera", inici: "1999-07-03", fi: "2003-06-14" }];

  it("aparella quan el nom i les dates lliguen", () => {
    const r = aparellaRetrat(persona("Jordi Camps", mandats), "08001", [
      { term: "1999-2003", nom: "Jordi Camps" },
    ]);
    expect(r).toEqual({ ok: true, termes: ["1999-2003"] });
  });

  /**
   * El nom sol no basta mai. Dos alcaldes del mateix poble poden dir-se igual
   * —pare i fill, sovint— i publicar la cara de l'un sobre el nom de l'altre és
   * el pitjor error que pot cometre aquesta feina.
   */
  it("no aparella si el nom lliga però les dates no es toquen", () => {
    const r = aparellaRetrat(persona("Jordi Camps", mandats), "08001", [
      { term: "2015-2019", nom: "Jordi Camps" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motiu).toContain("les dates no es toquen");
  });

  it("no aparella si no hi ha cap alcaldia nostra amb aquest nom", () => {
    const r = aparellaRetrat(persona("Jordi Camps", mandats), "08001", [
      { term: "1999-2003", nom: "Marta Puig" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motiu).toContain("cap alcaldia nostra amb aquest nom");
  });

  it("no aparella una persona que no ha manat mai en aquest municipi", () => {
    const r = aparellaRetrat(persona("Jordi Camps", mandats), "25120", [
      { term: "1999-2003", nom: "Jordi Camps" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motiu).toContain("cap mandat d'aquest municipi");
  });

  /**
   * Un mandat que encara dura no porta data de fi: si es tractés com un mandat
   * tancat el mateix dia que va començar, tots els alcaldes en actiu quedarien
   * sense cara.
   */
  it("un mandat sense data de fi es considera obert", () => {
    const enCurs = [{ ine5: "08001", municipi: "Abrera", inici: "2023-06-17", fi: null }];
    const r = aparellaRetrat(persona("Jordi Camps", enCurs), "08001", [
      { term: "2023-2027", nom: "Jordi Camps" },
    ]);
    expect(r).toEqual({ ok: true, termes: ["2023-2027"] });
  });

  /**
   * Una legislatura que no sabem llegir no pot decidir res: ni aparella ni
   * descarta. Val més perdre una cara que penjar-la on no toca.
   */
  it("una legislatura il·legible no aparella però tampoc descarta la bona", () => {
    const r = aparellaRetrat(persona("Jordi Camps", mandats), "08001", [
      { term: "des del 1999", nom: "Jordi Camps" },
      { term: "1999-2003", nom: "Jordi Camps" },
    ]);
    expect(r).toEqual({ ok: true, termes: ["1999-2003"] });
  });

  /**
   * El nom normalitzat és el de J21: sense accents, sense la conjunció «i» i
   * sense els parèntesis dels sobrenoms. «Antoni Josep Valentí (Anjo)» i
   * «Antoni Josep Valentí» són la mateixa persona.
   */
  it("aparella dues grafies del mateix nom", () => {
    const r = aparellaRetrat(persona("Josep Maria Pujadas i Roca", mandats), "08001", [
      { term: "1999-2003", nom: "Josep Maria Pujadas Roca" },
    ]);
    expect(r.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La llicència
// ─────────────────────────────────────────────────────────────────────────────

const buit = { codi: null, etiqueta: null, categories: null, atribucio: null };

describe("veredicteRetrat", () => {
  /** Els codis que J20 ja accepta han de continuar passant igual. */
  it("accepta els codis de la llista tancada de J20", () => {
    for (const codi of ["cc0", "cc-by-sa-4.0", "cc-by-2.0", "pd", "cc-by-4.0"]) {
      expect(veredicteRetrat({ ...buit, codi }).lliure).toBe(true);
    }
  });

  /**
   * L'ordre de les comprovacions és el de J20 i no és cap caprici:
   * «cc-by-nc-sa-4.0» conté «cc-by» i, si es mirés primer el que permet, un
   * fitxer no comercial s'esmunyiria amb tots els papers en regla.
   */
  it("el que prohibeix mana per damunt del que permet", () => {
    expect(veredicteRetrat({ ...buit, codi: "cc-by-nc-sa-4.0" }).lliure).toBe(false);
    expect(veredicteRetrat({ ...buit, codi: "cc-by-nd-4.0" }).lliure).toBe(false);
  });

  /**
   * Dos dels 363 porten una versió de Creative Commons adaptada a un país. Són
   * CC de ple dret, amb les mateixes obligacions, i el patró de J20 les deixava
   * fora només perquè s'acaba amb el número de versió.
   */
  it("accepta les versions de CC adaptades a un país", () => {
    const de = veredicteRetrat({ ...buit, codi: "cc-by-sa-3.0-de" });
    expect(de.lliure).toBe(true);
    expect(de.lliure === true && de.codi).toBe("cc-by-sa-3.0-de");
    expect(veredicteRetrat({ ...buit, codi: "cc-by-2.5-es" }).lliure).toBe(true);
  });

  /** Però una adaptada i no comercial continua sent no comercial. */
  it("una versió adaptada amb «nc» segueix fora", () => {
    expect(veredicteRetrat({ ...buit, codi: "cc-by-nc-3.0-es" }).lliure).toBe(false);
  });

  /**
   * Els 117 fitxers sense codi: plantilles d'atribució d'un ens, revisades per
   * Commons. S'accepten només amb les tres coses alhora, i el fitxer real de
   * l'alcalde de Gelida és el patró d'aquesta prova.
   */
  it("accepta una plantilla d'atribució amb les tres condicions alhora", () => {
    const v = veredicteRetrat({
      codi: null,
      etiqueta: "Attribution",
      categories: "Files from external sources with reviewed licenses|Attribution only license|Attribution-Gelida",
      atribucio: "Ajuntament de Gelida",
    });
    expect(v.lliure).toBe(true);
    expect(v.lliure === true && v.codi).toBe("attribution");
    expect(v.lliure === true && v.nom).toBe("Attribution");
  });

  /**
   * Sense la categoria, l'etiqueta sola no val: també la porten fitxers als
   * quals només els falta la metadada, i allà no sabem què hi ha darrere.
   */
  it("l'etiqueta sola no obre la porta", () => {
    expect(
      veredicteRetrat({ codi: null, etiqueta: "Attribution", categories: null, atribucio: "Algú" }).lliure,
    ).toBe(false);
  });

  /**
   * I sense la citació tampoc: l'única condició d'aquesta llicència és dir a qui
   * s'atribueix, i si no ho sabem no la podem complir.
   */
  it("sense la citació literal tampoc", () => {
    expect(
      veredicteRetrat({
        codi: null,
        etiqueta: "Attribution",
        categories: "Attribution only license",
        atribucio: null,
      }).lliure,
    ).toBe(false);
  });

  it("sense res de res, no es publica", () => {
    expect(veredicteRetrat(buit).lliure).toBe(false);
    expect(veredicteRetrat({ ...buit, codi: "gfdl" }).lliure).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La resposta de Commons
// ─────────────────────────────────────────────────────────────────────────────

const pagina = (titol: string, extra: Record<string, string | null>, url = "https://upload.wikimedia.org/x.jpg") => ({
  title: titol,
  imageinfo: [
    {
      url,
      descriptionurl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(titol)}`,
      extmetadata: Object.fromEntries(
        Object.entries(extra).flatMap(([k, v]) => (v === null ? [] : [[k, { value: v }]])),
      ),
    },
  ],
});

describe("llegeixRetrats", () => {
  it("desa l'URL, la pàgina de descripció, l'autor i la llicència", () => {
    const json = {
      query: {
        pages: [
          pagina("File:Siurana.jpg", {
            License: "cc-by-sa-4.0",
            LicenseShortName: "CC BY-SA 4.0",
            Artist: '<a href="/wiki/User:Kilo567">Kilo567</a>',
          }),
        ],
      },
    };
    const r = llegeixRetrats(json, ["File:Siurana.jpg"]).get("File:Siurana.jpg");
    expect(r!.ok).toBe(true);
    if (!r!.ok) return;
    expect(r!.retrat.url).toBe("https://upload.wikimedia.org/x.jpg");
    expect(r!.retrat.pagina).toContain("commons.wikimedia.org/wiki/");
    // L'autor arriba com a HTML perquè a Commons és un camp de text lliure.
    expect(r!.retrat.autor).toBe("Kilo567");
    expect(r!.retrat.llicenciaNom).toBe("CC BY-SA 4.0");
  });

  /**
   * Sense autor no es publica, encara que la llicència sigui CC BY: la citació
   * és **l'única** condició que posa, i una foto sense dir de qui és l'incompleix
   * tant si és per mala fe com si és per un camp buit.
   */
  it("descarta un fitxer sense autor encara que la llicència sigui lliure", () => {
    const json = { query: { pages: [pagina("File:Sense.jpg", { License: "cc-by-4.0" })] } };
    const r = llegeixRetrats(json, ["File:Sense.jpg"]).get("File:Sense.jpg");
    expect(r!.ok).toBe(false);
    expect(r!.ok === false && r!.descartat.motiu).toContain("autor");
  });

  /** CC0 no obliga a citar ningú, però Commons en publica igualment l'autor. */
  it("desa la citació literal de les plantilles d'atribució", () => {
    const json = {
      query: {
        pages: [
          pagina("File:Gelida.jpg", {
            LicenseShortName: "Attribution",
            Categories: "Attribution only license",
            Attribution: "Ajuntament de Gelida",
            Artist: "Ajuntament de Gelida",
          }),
        ],
      },
    };
    const r = llegeixRetrats(json, ["File:Gelida.jpg"]).get("File:Gelida.jpg");
    expect(r!.ok).toBe(true);
    if (!r!.ok) return;
    expect(r!.retrat.llicencia).toBe("attribution");
    expect(r!.retrat.atribucio).toBe("Ajuntament de Gelida");
  });

  /**
   * El que **no** torna la resposta també és informació: un fitxer que Commons
   * no coneix no és un fitxer sense problema, és un fitxer del qual no sabem la
   * llicència. Sense aquesta comprovació passaria per bo per omissió.
   */
  it("un fitxer que Commons no torna queda descartat, no oblidat", () => {
    const r = llegeixRetrats({ query: { pages: [] } }, ["File:Fantasma.jpg"]);
    const resultat = r.get("File:Fantasma.jpg");
    expect(resultat!.ok).toBe(false);
    expect(resultat!.ok === false && resultat!.descartat.motiu).toContain("no coneix");
  });

  it("sense URL no hi ha imatge i sense pàgina no hi ha on atribuir", () => {
    const json = {
      query: {
        pages: [
          { title: "File:Cap.jpg", imageinfo: [{ extmetadata: { License: { value: "cc0" } } }] },
        ],
      },
    };
    const r = llegeixRetrats(json, ["File:Cap.jpg"]).get("File:Cap.jpg");
    expect(r!.ok).toBe(false);
    expect(r!.ok === false && r!.descartat.motiu).toContain("URL");
  });

  /** Commons tracta els guions baixos com a espais i posa la inicial en majúscula. */
  it("normalitza el títol a l'anada i a la tornada", () => {
    const json = { query: { pages: [pagina("File:Un retrat.jpg", { License: "cc0", Artist: "Algú" })] } };
    expect(llegeixRetrats(json, ["file:un_retrat.jpg"]).get("File:Un retrat.jpg")!.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Els camins i la fitxa
// ─────────────────────────────────────────────────────────────────────────────

describe("idDeQid i camiPublicHistoric", () => {
  /**
   * L'identificador surt del QID i no d'un resum de l'URL: qui trobi
   * `14320.webp` al disc pot anar a Wikidata a veure de qui és la cara.
   */
  it("el número del QID és el nom del fitxer", () => {
    expect(idDeQid("Q14320")).toBe(14320);
    expect(idDeQid("q1")).toBe(1);
  });

  it("un QID que no ho és no dona cap identificador", () => {
    expect(idDeQid("")).toBeNull();
    expect(idDeQid("Qxyz")).toBeNull();
    expect(idDeQid("Q0")).toBeNull();
  });

  /**
   * El calaix propi no és estètica: J11 desa amb els identificadors de seu-e i
   * aquí amb els de Wikidata, i dos espais de noms al mateix directori acabarien
   * fent que una cara en substituís una altra sense que ningú ho veiés.
   */
  it("les miniatures viuen en un calaix a part de les de seu-e", () => {
    expect(camiPublicHistoric(320, 14320)).toBe("/observatori/fotos/historics/320/14320.webp");
    expect(camiPublicHistoric(160, 14320)).toBe("/observatori/fotos/historics/160/14320.webp");
  });
});

describe("alcaldesDiferents", () => {
  /**
   * Qui ha fet quatre mandats seguits és una cara, no quatre. Comptar files en
   * comptes de persones inflaria el denominador i faria semblar la cobertura
   * encara més petita del que ja és.
   */
  it("compta persones i no files d'historial", () => {
    expect(
      alcaldesDiferents([
        { term: "2011-2015", nom: "Jordi Camps" },
        { term: "2015-2019", nom: "Jordi Camps" },
        { term: "2019-2023", nom: "Marta Puig" },
      ]),
    ).toBe(2);
  });

  it("dues grafies del mateix nom són una sola persona", () => {
    expect(
      alcaldesDiferents([
        { term: "2011-2015", nom: "Josep Maria Pujadas i Roca" },
        { term: "2015-2019", nom: "Josep Maria Pujadas Roca" },
      ]),
    ).toBe(1);
  });

  it("un municipi sense historial no té cap alcalde", () => {
    expect(alcaldesDiferents([])).toBe(0);
  });
});

describe("fitxaRetrats", () => {
  const retrat = (nom: string, inici: string): RetratDesat => ({
    qid: "Q1",
    url: "https://www.wikidata.org/wiki/Q1",
    nom,
    termes: ["1999-2003"],
    mandats: [{ inici, fi: null }],
    foto: camiPublicHistoric(320, 1),
    fotoPetita: camiPublicHistoric(160, 1),
    fitxer: "File:Foto.jpg",
    pagina: "https://commons.wikimedia.org/wiki/File:Foto.jpg",
    autor: "Ajuntament de Gelida",
    llicencia: "attribution",
    llicenciaNom: "Attribution",
    atribucio: "Ajuntament de Gelida",
  });

  /**
   * La xifra de cobertura viu a la fitxa i no al cap de qui la publica: «3 de
   * 14» és el que ha de llegir la gent, perquè una graella amb tres cares i onze
   * siluetes buides no informa de res i sembla que assenyali.
   */
  it("desa quants alcaldes hi ha i quants en tenen cara", () => {
    const f = fitxaRetrats("08001", 14, [retrat("A", "1999-07-03"), retrat("B", "2011-06-11")], "2026-08-30");
    expect(f.totalAlcaldesNostres).toBe(14);
    expect(f.ambRetrat).toBe(2);
  });

  it("cap dada sense font, llicència i data", () => {
    const f = fitxaRetrats("08001", 14, [retrat("A", "1999-07-03")], "2026-08-30");
    expect(f.font).toContain("Wikidata");
    expect(f.fontImatges).toContain("Commons");
    expect(f.llicenciaDades).toBe("CC0 1.0");
    expect(f.descarregat).toBe("2026-08-30");
    expect(f.ine5).toBe("08001");
  });

  /** Cronològic: la fitxa d'un municipi es llegeix com una línia de temps. */
  it("ordena els retrats del més antic al més nou", () => {
    const f = fitxaRetrats(
      "08001",
      14,
      [retrat("Nou", "2011-06-11"), retrat("Vell", "1983-05-08")],
      "2026-08-30",
    );
    expect(f.retrats.map((r) => r.nom)).toEqual(["Vell", "Nou"]);
  });

  /** Cada cara desa el seu autor i la seva llicència, o no es podria publicar. */
  it("cada retrat porta autor, llicència i, si cal, la citació literal", () => {
    const [r] = fitxaRetrats("08001", 14, [retrat("A", "1999-07-03")], "2026-08-30").retrats;
    expect(r!.autor).toBe("Ajuntament de Gelida");
    expect(r!.llicenciaNom).toBe("Attribution");
    expect(r!.atribucio).toBe("Ajuntament de Gelida");
    expect(r!.pagina).toContain("commons.wikimedia.org");
  });
});

describe("trossos", () => {
  it("parteix la llista en grups de la mida demanada", () => {
    expect(trossos([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(trossos([], 50)).toEqual([]);
  });
});
