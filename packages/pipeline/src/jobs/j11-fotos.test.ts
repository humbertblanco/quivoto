import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCarrecs } from "../adapters/seue";
import {
  camiPublic,
  classificaPagina,
  cobertura,
  fitxaCarrecs,
  fontQueMana,
  gransPrimer,
  liniaInforme,
  midaMiniatura,
  motiuDeLaPagina,
  motiuDelResultat,
  nombreEntorn,
  potSubstituir,
  resumFaltes,
  teTotesLesCares,
  type Diagnostic,
} from "./j11-fotos";

const html = readFileSync(
  join(__dirname, "..", "adapters", "__fixtures__", "carrecs-electes.html"),
  "utf8",
);

describe("cobertura", () => {
  /**
   * És l'única cosa que la fitxa mira per decidir si ensenya les cares: mig
   * consistori amb foto i mig amb silueta buida assenyala qui no en té.
   */
  it("distingeix els tres casos que la fitxa necessita", () => {
    expect(cobertura(17, 17)).toBe("completa");
    expect(cobertura(17, 15)).toBe("parcial");
    expect(cobertura(17, 0)).toBe("cap");
  });

  it("un municipi sense càrrecs no té cobertura", () => {
    expect(cobertura(0, 0)).toBe("cap");
  });
});

describe("fitxaCarrecs", () => {
  const carrecs = parseCarrecs(html);
  const totes = new Set(carrecs.flatMap((c) => (c.fotoId === null ? [] : [c.fotoId])));

  it("desa la font, l'enllaç i la data: cap dada sense procedència", () => {
    const f = fitxaCarrecs("girona", carrecs, totes, "2026-08-29");
    expect(f.font).toContain("seu-e.cat");
    expect(f.url).toBe(
      "https://seu-e.cat/ca/web/girona/govern-obert-i-transparencia" +
        "/informacio-institucional-i-organitzativa/organitzacio-politica-i-retribucions" +
        "/carrecs-electes",
    );
    expect(f.descarregat).toBe("2026-08-29");
  });

  it("compta com a parcial el consistori on algú no té foto", () => {
    // Al fixture hi ha 4 càrrecs i només 3 tenen fotografia.
    const f = fitxaCarrecs("girona", carrecs, totes, "2026-08-29");
    expect(f.totalCarrecs).toBe(4);
    expect(f.ambFoto).toBe(3);
    expect(f.cobertura).toBe("parcial");
  });

  /**
   * Que seu-e anunciï una foto no vol dir que se n'hagi pogut fer la miniatura:
   * n'hi ha de massa petites i n'hi ha que responen buides. Si el camí es desés
   * a partir del `fotoId`, la fitxa acabaria amb imatges trencades.
   */
  it("només posa el camí de les miniatures que existeixen de veritat", () => {
    const nomesUna = new Set([25009]);
    const f = fitxaCarrecs("girona", carrecs, nomesUna, "2026-08-29");
    expect(f.carrecs[0]!.foto).toBe("/observatori/fotos/320/25009.webp");
    expect(f.carrecs[0]!.fotoPetita).toBe("/observatori/fotos/160/25009.webp");
    expect(f.carrecs[1]!.fotoId).toBe(25105);
    expect(f.carrecs[1]!.foto).toBeNull();
    expect(f.carrecs[1]!.fotoPetita).toBeNull();
    expect(f.ambFoto).toBe(1);
  });

  it("qui no té foto la té a null, no un camí inventat", () => {
    const f = fitxaCarrecs("corberadellobregat", carrecs, totes, "2026-08-29");
    expect(f.carrecs[3]!.fotoId).toBeNull();
    expect(f.carrecs[3]!.foto).toBeNull();
  });

  it("conserva nom, càrrec, grup i equip de govern", () => {
    const f = fitxaCarrecs("girona", carrecs, totes, "2026-08-29");
    expect(f.carrecs[0]).toMatchObject({
      nom: "Lluc Salellas i Vilar",
      carrec: "Alcalde",
      grup: "Guanyem Girona (GGI - AMUNT)",
      equipGovern: true,
    });
  });

  it("guarda l'enllaç a la fitxa de seu-e per poder anar a la font", () => {
    const f = fitxaCarrecs("girona", carrecs, totes, "2026-08-29");
    expect(f.carrecs[0]!.fitxa).toContain("veureCarrec/25009");
    expect(f.carrecs[0]!.fitxa).not.toContain("p_auth");
  });
});

describe("camiPublic", () => {
  it("separa les dues mides, que conviuen amb el mateix id", () => {
    expect(camiPublic(160, 25009)).toBe("/observatori/fotos/160/25009.webp");
    expect(camiPublic(320, 25009)).toBe("/observatori/fotos/320/25009.webp");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// El lector de seu-e i la regla que no aparella per nom
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dos blocs tal com els escriu seu-e: el primer amb foto, el segon amb el
 * logotip del grup al mateix forat. És exactament la trampa que hi ha a la
 * pàgina real, i el motiu pel qual no es pot agafar «la primera imatge del
 * bloc» ni, encara menys, buscar la cara pel nom.
 */
const BLOC_DOS_REGIDORS = `
<div class="organ-principal-grup-div">
  <div class="organ-principal-grup-div-nom">Partit d'Exemple (PEX)<small>(2 càrrecs electes)</small></div>
</div>
<div class="organ-principal-carrecs-item">
  <img src="/ca/web/exemple/carrecs-electes/-/grupPolitic/getPhotoBytes/1001" alt="">
  <p class="organ-principal-carrecs-item-dades-nom">Maria Puig i Solà</p>
  <p class="organ-principal-carrecs-item-dades-carrec">Alcaldessa</p>
  <span class="organ-principal-carrecs-item-dades-eqgob-membre">Membre d'equip de govern</span>
  <a href="/ca/web/exemple/carrecs-electes/-/grupPolitic/veureCarrec/1001?p_auth=Ab12Cd34">Fitxa</a>
</div>
<div class="organ-principal-carrecs-item">
  <img class="grupLogoImg" src="/ca/web/exemple/logos/pex.png" alt="Logo Partit d'Exemple">
  <p class="organ-principal-carrecs-item-dades-nom">Maria Puig i Sola</p>
  <p class="organ-principal-carrecs-item-dades-carrec">Regidora</p>
</div>
`;

describe("lector de la pàgina de seu-e", () => {
  const carrecs = parseCarrecs(BLOC_DOS_REGIDORS);

  it("llegeix nom, càrrec, grup i equip de govern del mateix bloc", () => {
    expect(carrecs).toHaveLength(2);
    expect(carrecs[0]).toMatchObject({
      nom: "Maria Puig i Solà",
      carrec: "Alcaldessa",
      grup: "Partit d'Exemple (PEX)",
      fotoId: 1001,
      equipGovern: true,
    });
    // El recompte del `<small>` no forma part del nom del grup.
    expect(carrecs[0]!.grup).not.toContain("càrrecs electes");
  });

  it("treu el token de sessió de l'enllaç a la fitxa: caduca en dies", () => {
    expect(carrecs[0]!.fitxa).toContain("veureCarrec/1001");
    expect(carrecs[0]!.fitxa).not.toContain("p_auth");
  });

  /**
   * El segon regidor porta el logotip del partit al lloc de la cara. Si el
   * lector agafés la primera imatge del bloc, la fitxa ensenyaria un logo com
   * si fos una persona —i els logos, a més, tenen l'ús prohibit a l'avís legal.
   */
  it("no confon el logotip del grup amb una cara", () => {
    expect(carrecs[1]!.fotoId).toBeNull();
  });

  /**
   * La regla dura del projecte: una foto es lliga a una persona pel bloc de
   * HTML on totes dues viuen, mai pel nom. Aquí els dos noms només es
   * diferencien per un accent —«Solà» i «Sola»—, que és justament el cas on
   * qualsevol comparació aproximada de noms diria que són la mateixa persona.
   */
  it("no aparella per nom: qui no porta foto al seu bloc es queda sense", () => {
    const f = fitxaCarrecs("exemple", carrecs, new Set([1001]), "2026-08-30");
    expect(f.carrecs[0]!.foto).toBe("/observatori/fotos/320/1001.webp");
    expect(f.carrecs[1]!.foto).toBeNull();
    expect(f.carrecs[1]!.fotoPetita).toBeNull();
    expect(f.ambFoto).toBe(1);
  });

  it("una foto que no s'ha pogut desar tampoc no s'hereta del veí", () => {
    const f = fitxaCarrecs("exemple", carrecs, new Set<number>(), "2026-08-30");
    expect(f.carrecs.every((c) => c.foto === null)).toBe(true);
    expect(f.cobertura).toBe("cap");
  });
});

describe("classificaPagina", () => {
  const farciment = "x".repeat(6_000);

  it("reconeix el mòdul de càrrecs quan hi ha algú", () => {
    expect(classificaPagina(`<title>Càrrecs electes</title>${farciment}${BLOC_DOS_REGIDORS}`)).toBe(
      "modul",
    );
  });

  /**
   * Manresa, Cornellà, Vilanova i cinc més: la pàgina hi és i el mòdul és un
   * Tableau que ve de municat.gencat.cat. Té els noms, però no una sola foto,
   * i per això no és cap error del lector sinó una font que no en porta.
   */
  it("reconeix el Tableau incrustat, que no porta cap fotografia", () => {
    const pagina =
      "<title>Càrrecs electes - Ajuntament de Manresa</title>" +
      farciment +
      '<script src="https://public.tableau.com/javascripts/api/viz_v1.js"></script>' +
      '<a href="https://dadesobertes.seu-e.cat/dataset/iio-op-carrecs-electes">Accedeix</a>';
    expect(classificaPagina(pagina)).toBe("tableau");
  });

  /**
   * Reus respon 200 amb 2 kB de verificació de bot. Comptar-ho com un mòdul
   * buit ens deia «Reus no publica càrrecs», que és fals: el que passa és que
   * d'allà no en surt res sense navegador.
   */
  it("no confon una pàgina que no ha arribat amb un mòdul buit", () => {
    expect(classificaPagina('<html><body><script src="/ruxitagentjs.js"></script></body></html>')).toBe(
      "bloquejada",
    );
    expect(classificaPagina("")).toBe("bloquejada");
  });

  it("una pàgina sencera sense càrrecs és un mòdul buit", () => {
    expect(classificaPagina(`<title>Càrrecs electes</title>${farciment}`)).toBe("modul-buit");
  });
});

describe("motiuDeLaPagina", () => {
  it("una pàgina amb mòdul no és cap motiu de queixa", () => {
    expect(motiuDeLaPagina("modul")).toBeNull();
  });

  /**
   * Els tres carrerons sense sortida demanen feines diferents: el Tableau vol
   * una altra font, la pàgina bloquejada vol un navegador i el mòdul buit vol
   * que algú vagi a preguntar-ho a l'ajuntament.
   */
  it("separa el Tableau, la pàgina que no arriba i el mòdul buit", () => {
    expect(motiuDeLaPagina("tableau")).toBe("modul-tableau");
    expect(motiuDeLaPagina("bloquejada")).toBe("pagina-bloquejada");
    expect(motiuDeLaPagina("modul-buit")).toBe("modul-buit");
  });
});

describe("motiuDelResultat", () => {
  it("les que han anat bé no falten", () => {
    expect(motiuDelResultat("desada")).toBeNull();
    expect(motiuDelResultat("ja-hi-era")).toBeNull();
  });

  it("separa els tres fracassos, que demanen coses diferents", () => {
    expect(motiuDelResultat("petita")).toBe("foto-massa-petita");
    expect(motiuDelResultat("sense-foto")).toBe("foto-buida");
    expect(motiuDelResultat("error")).toBe("foto-illegible");
  });
});

describe("midaMiniatura", () => {
  /**
   * Sant Boi de Llobregat serveix les 25 cares a 120×151. Estirar-les fins a
   * 320 no hi afegeix cap detall i multiplica els bytes: la miniatura «de 320»
   * en surt de 120 i el navegador ja l'encabeix als 120 px on es dibuixa.
   */
  it("no infla mai la foto per sobre de l'original", () => {
    expect(midaMiniatura(320, { amplada: 120, alcada: 151 })).toBe(120);
    expect(midaMiniatura(160, { amplada: 120, alcada: 151 })).toBe(120);
  });

  it("amb un original gran, la mida demanada mana", () => {
    expect(midaMiniatura(320, { amplada: 1536, alcada: 1920 })).toBe(320);
  });
});

describe("gransPrimer", () => {
  /**
   * Amb sis obrers i una hora llarga de feina, l'ordre decideix qui queda desat
   * si la cosa peta a mitja tarda. Els municipis on mira més gent van primer.
   */
  it("ordena de més a menys població", () => {
    const munis = [
      { name: "Abella de la Conca", population: 156 },
      { name: "Barcelona", population: 1_731_649 },
      { name: "Girona", population: 108_666 },
    ];
    expect(gransPrimer(munis).map((m) => m.name)).toEqual([
      "Barcelona",
      "Girona",
      "Abella de la Conca",
    ]);
  });

  it("els que no tenen padró van al final i no al davant", () => {
    const munis = [
      { name: "Sense padró", population: null },
      { name: "Girona", population: 108_666 },
    ];
    expect(gransPrimer(munis).map((m) => m.name)).toEqual(["Girona", "Sense padró"]);
  });

  it("desempata pel nom perquè dues execucions facin el mateix", () => {
    const munis = [
      { name: "Bellcaire", population: 700 },
      { name: "Alcarràs", population: 700 },
    ];
    expect(gransPrimer(munis).map((m) => m.name)).toEqual(["Alcarràs", "Bellcaire"]);
  });
});

describe("nombreEntorn", () => {
  it("agafa el número de l'entorn quan és un número", () => {
    expect(nombreEntorn("30", 20)).toBe(30);
  });

  it("no deixa passar brossa ni zeros: es queda amb el valor per defecte", () => {
    expect(nombreEntorn(undefined, 20)).toBe(20);
    expect(nombreEntorn("", 20)).toBe(20);
    expect(nombreEntorn("moltíssims", 20)).toBe(20);
    expect(nombreEntorn("0", 20)).toBe(20);
    expect(nombreEntorn("-5", 20)).toBe(20);
  });
});

describe("potSubstituir i fontQueMana", () => {
  const bcn = { font: "Barcelona · Llicència: Creative Commons Attribution 4.0", ambFoto: 41, totalCarrecs: 41 };

  /**
   * A seu-e, Barcelona dona 404 i Lleida, Tarragona i l'Hospitalet tenen la
   * pàgina amb el mòdul buit: si J11 passa després de J13, la seva fitxa
   * sencera es canviaria per una llista de noms sense cap cara.
   */
  it("no trepitja la fitxa d'una altra font que té més cares", () => {
    expect(potSubstituir(bcn, { ambFoto: 0 })).toBe(false);
    expect(fontQueMana(bcn, 0)).toEqual(bcn);
  });

  it("sí que la substitueix si la nostra no hi perd cap cara", () => {
    expect(potSubstituir(bcn, { ambFoto: 41 })).toBe(true);
    expect(fontQueMana(bcn, 41)).toBeNull();
  });

  /**
   * La nostra fitxa d'ahir sí que es refresca encara que empitjori: si seu-e ha
   * tret una foto, la fitxa publicada no pot seguir ensenyant-la.
   */
  it("la nostra pròpia fitxa d'ahir sempre es refresca", () => {
    const ahir = { font: "seu-e.cat (Consorci AOC)", ambFoto: 27, totalCarrecs: 27 };
    expect(potSubstituir(ahir, { ambFoto: 0 })).toBe(true);
    expect(fontQueMana(ahir, 0)).toBeNull();
  });

  it("sense fitxa prèvia no hi ha res a protegir", () => {
    expect(potSubstituir(undefined, { ambFoto: 0 })).toBe(true);
    expect(fontQueMana(undefined, 0)).toBeNull();
  });
});

describe("informe dels municipis més grans", () => {
  const base: Diagnostic = {
    municipi: "Sant Boi de Llobregat",
    poblacio: 85_610,
    slug: "santboidellobregat",
    totalCarrecs: 25,
    ambFoto: 25,
    motiu: null,
    falten: [],
    altraFont: null,
  };

  it("diu quants càrrecs hi ha i quants tenen cara", () => {
    expect(liniaInforme(base)).toBe("Sant Boi de Llobregat (85.610 hab.): 25/25 amb foto");
  });

  it("diu quants en falten i per què, agrupat per motiu", () => {
    const linia = liniaInforme({
      ...base,
      ambFoto: 21,
      falten: [
        { nom: "A", motiu: "seu-e-no-publica-foto" },
        { nom: "B", motiu: "seu-e-no-publica-foto" },
        { nom: "C", motiu: "foto-massa-petita" },
        { nom: "D", motiu: "foto-buida" },
      ],
    });
    expect(linia).toContain("21/25 amb foto");
    expect(linia).toContain("falten 4");
    expect(linia).toContain("2 · seu-e no en publica la foto");
    expect(linia).toContain("1 · l'original no arriba a 120 px");
  });

  /** Reus i Terrassa no són el mateix problema, i la línia ho ha de dir. */
  it("quan no hi ha cap càrrec, explica quina paret hem trobat", () => {
    expect(liniaInforme({ ...base, municipi: "Reus", poblacio: 111_601, totalCarrecs: 0, ambFoto: 0, motiu: "pagina-bloquejada" }))
      .toBe("Reus (111.601 hab.): cap càrrec llegit — seu-e respon 200 amb un cos que no és la pàgina");
    expect(liniaInforme({ ...base, municipi: "Terrassa", poblacio: 233_270, totalCarrecs: 0, ambFoto: 0, motiu: "fora-de-seu-e" }))
      .toContain("cap slug de seu-e no respon");
  });

  /**
   * Tarragona té el mòdul de seu-e buit i la fitxa publicada plena: les cares
   * les baixa J13 de la web de l'ajuntament. Dir «0 de 27» seria fals.
   */
  it("quan mana una altra font, l'informe compta les cares que es publiquen", () => {
    const d: Diagnostic = {
      ...base,
      municipi: "Tarragona",
      poblacio: 143_649,
      totalCarrecs: 0,
      ambFoto: 0,
      motiu: "modul-tableau",
      altraFont: { font: "Tarragona · avís legal", ambFoto: 27, totalCarrecs: 27 },
    };
    expect(liniaInforme(d)).toContain("27/27 amb foto · font: Tarragona · avís legal");
    expect(liniaInforme(d)).toContain("a seu-e, la pàgina serveix un Tableau");
    expect(teTotesLesCares(d)).toBe(true);
  });

  it("teTotesLesCares no diu que sí quan no hi ha cap càrrec llegit", () => {
    expect(teTotesLesCares({ ...base, totalCarrecs: 0, ambFoto: 0 })).toBe(false);
    expect(teTotesLesCares({ ...base, ambFoto: 24 })).toBe(false);
    expect(teTotesLesCares(base)).toBe(true);
  });

  it("un municipi sense padró no fa petar la línia", () => {
    expect(liniaInforme({ ...base, poblacio: null })).toContain("(? hab.)");
  });

  it("resumFaltes agrupa i no repeteix el motiu", () => {
    expect(resumFaltes([{ nom: "A", motiu: "foto-illegible" }, { nom: "B", motiu: "foto-illegible" }]))
      .toBe("2 · els bytes no són cap imatge llegible");
    expect(resumFaltes([])).toBe("");
  });
});
