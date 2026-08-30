import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CopiaDesadaAbsentError,
  FONTS,
  LlicenciaDenegadaError,
  MATARO_GRUPS,
  clauFotoTerrassa,
  fotosDe,
  nomsCompatibles,
  parseBarcelona,
  parseHospitalet,
  parseLleida,
  parseMataro,
  parseTarragona,
  parseTerrassa,
  urlMataro,
} from "./fotos-ciutats";

/**
 * Totes les fixtures són retalls **literals** del HTML i del JSON que van
 * respondre els servidors el 29 d'agost de 2026. No s'han netejat: si un lector
 * només funciona amb HTML endreçat, val més saber-ho aquí que en producció.
 *
 * La de Terrassa és l'excepció que confirma la regla: el servidor no respon a
 * cap client HTTP, i el retall és el DOM de la pàgina oberta amb el navegador
 * el 30 d'agost de 2026, transcrit element a element (ho explica ella mateixa).
 */
const fixture = (nom: string) => readFileSync(join(__dirname, "__fixtures__", nom), "utf8");

// ─────────────────────────────────────────────────────────────────────────────

describe("parseBarcelona", () => {
  /*
   * La fixture porta les cinc files que decideixen el lector: l'alcalde, una
   * regidora, un regidor adscrit, un gerent (que s'ha de descartar) i una
   * persona amb la imatge de plantilla.
   */
  const carrecs = parseBarcelona(fixture("fotos-barcelona.json"));

  it("es queda només amb els càrrecs electes", () => {
    expect(carrecs.map((c) => c.nom)).toEqual([
      "Jaume Collboni Cuadrado",
      "Antonio Verdera Puntí",
      "Elisenda Alamany Gutierrez",
    ]);
  });

  it("descarta els gerents, que no són electes", () => {
    expect(carrecs.some((c) => c.nom.startsWith("Àfrica"))).toBe(false);
  });

  it("compta «Regidor Adscrit» com a càrrec electe", () => {
    expect(carrecs.find((c) => c.nom === "Antonio Verdera Puntí")?.carrec).toBe("Regidor Adscrit");
  });

  it("posa l'alcalde primer, per pes del càrrec i no per ordre del fitxer", () => {
    expect(carrecs[0]!.carrec).toBe("Alcalde");
  });

  it("dona la URL de la foto tal com la publica el dataset", () => {
    expect(carrecs[0]!.foto).toBe(
      "https://apidocs.barcelona.cat/retribucions_pro/JaumeCollboniCuadrado_Foto.jpg",
    );
  });

  it("llegeix el grup del partit polític", () => {
    expect(carrecs[0]!.grup).toBe("PSC");
    expect(carrecs[2]!.grup).toBe("ERC");
  });

  it("no accepta la imatge de plantilla com si fos una cara", () => {
    // «dni foto.png» és la mateixa per a tothom qui encara no té retrat.
    expect(fixture("fotos-barcelona.json")).toContain("dni%20foto.png");
    expect(carrecs.every((c) => c.foto === null || !/dni/i.test(c.foto))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("parseTarragona", () => {
  const carrecs = parseTarragona(fixture("fotos-tarragona.html"));

  it("llegeix nom, càrrec i foto de cada targeta", () => {
    expect(carrecs).toHaveLength(3);
    expect(carrecs[0]!.nom).toBe("Rubén Viñuales Elías");
    expect(carrecs[0]!.carrec).toBe("Alcalde | Conseller de Seguretat Ciutadana");
  });

  it("desa l'apòstrof tipogràfic tal com l'escriu l'ajuntament", () => {
    expect(carrecs[1]!.carrec).toContain("tinenta d’alcalde");
  });

  it("agafa la foto del bloc i no la dedueix del nom", () => {
    /*
     * El slug de la imatge de l'alcalde porta un `copy_of_` que el seu nom no
     * insinua enlloc: construir la URL a partir del nom fallaria aquí.
     */
    expect(carrecs[0]!.foto).toBe(
      "https://www.tarragona.cat/lajuntament/govern/ple/conselleres-i-consellers/apartats/copy_of_ruben-vinuales-elias/image_large",
    );
    expect(carrecs[1]!.foto).not.toContain("copy_of_");
  });

  it("no s'inventa cap grup municipal, que la pàgina no diu", () => {
    expect(carrecs.every((c) => c.grup === null)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("parseLleida", () => {
  const carrecs = parseLleida(fixture("fotos-lleida.html"));

  it("llegeix el nom i la fitxa de cada regidor", () => {
    expect(carrecs).toHaveLength(3);
    expect(carrecs.map((c) => c.nom)).toEqual([
      "Fèlix Larrosa Piqué",
      "Begoña Iglesias Delgado",
      "Laura Bergés Saura",
    ]);
    expect(carrecs[0]!.fitxa).toBe(
      "https://www.paeria.cat/ca/ajuntament/grups-municipals/psc/felix-larrosa-pique",
    );
  });

  it("treu el grup del camí de la URL, que és on és", () => {
    /*
     * La fixture porta dos grups seguits: si el grup s'agafés de l'últim títol
     * de secció vist, el tercer regidor sortiria com a `psc`.
     */
    expect(carrecs.map((c) => c.grup)).toEqual(["psc", "psc", "comu-de-lleida"]);
  });

  it("dona la foto absoluta", () => {
    expect(carrecs[1]!.foto).toBe(
      "https://www.paeria.cat/ca/ajuntament/grups-municipals/psc/begona-iglesias-delgado/@@images/image/preview",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("parseMataro", () => {
  const carrecs = parseMataro(fixture("fotos-mataro.html"), "grup-municipal-psc-cp");

  it("llegeix cada regidor amb el seu retrat", () => {
    expect(carrecs).toHaveLength(3);
    expect(carrecs[0]!.nom).toBe("David Bote Paz");
    expect(carrecs[0]!.foto).toContain("/david-bote-paz/@@images/");
  });

  it("posa el grup que se li passa, perquè la pàgina només en cobreix un", () => {
    expect(carrecs.every((c) => c.grup === "grup-municipal-psc-cp")).toBe(true);
  });

  it("munta la URL de cada grup", () => {
    expect(urlMataro(MATARO_GRUPS[0])).toBe(
      "https://www.mataro.cat/ca/lajuntament/grups-municipals/grup-municipal-psc-cp/regidors",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("parseHospitalet", () => {
  const carrecs = parseHospitalet(fixture("fotos-hospitalet.html"));

  it("aparella foto i nom per l'atribut alt, sense comparar noms", () => {
    expect(carrecs.map((c) => c.nom)).toEqual([
      "David Quirós Brito",
      "Jesús Husillos Gutiérrez",
      "Laura García Manota",
      "David Gómez Luque",
    ]);
  });

  it("treu el grup del parèntesi del titular", () => {
    expect(carrecs[0]!.grup).toBe("PSC-CP");
  });

  it("fa absoluta la URL opaca de la imatge", () => {
    expect(carrecs[0]!.foto).toMatch(
      /^https:\/\/seuelectronica\.l-h\.cat\/utils\/obreFitxer\.ashx\?/,
    );
  });

  it("deixa el càrrec buit, perquè la pàgina de biografies no en diu cap", () => {
    expect(carrecs.every((c) => c.carrec === "")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("parseTerrassa", () => {
  const carrecs = parseTerrassa(fixture("terrassa-consistori.html"));

  it("aparella cada retrat amb el nom de la fila de sota, columna per columna", () => {
    expect(carrecs.map((c) => c.nom)).toEqual([
      "Jordi Ballart i Pastor",
      "Patrícia Reche Martínez",
      "Meritxell Lluís i Vall",
      "Montserrat Caupena i Mas",
      "Carles Lázaro Hernando",
      "Marc Armengol Puig",
      "Ona Martínez Viñas",
      "Josep Forn Cadafalch",
      "Marta Giménez Arcusa",
      "Maria del Carmen Vaya López",
    ]);
    expect(carrecs[0]!.foto).toBe(
      "https://www.terrassa.cat/documents/12006/62063442/Jordi+Ballart+Pastor+TXT.jpg/5efeb063-171a-49b7-ad0a-a0affc19ab11?t=1687246991283",
    );
    expect(carrecs[1]!.foto).toContain("Patr%C3%ADcia+Reche");
    expect(carrecs.every((c) => c.foto !== null)).toBe(true);
  });

  it("llegeix el càrrec tal com l'escriu la pàgina, línia a línia", () => {
    expect(carrecs[0]!.carrec).toBe("Alcalde");
    expect(carrecs[1]!.carrec).toBe("Regidora · 1a.Tinenta d'Alcalde");
    expect(carrecs[2]!.carrec).toBe("Regidora · 3a.Tinenta d'Alcalde");
    // Josep Forn té el càrrec en un paràgraf a part, i no s'ha de perdre.
    expect(carrecs[7]!.carrec).toBe("Regidor");
  });

  it("treu el grup del logo que encapçala cada tanda, també el d'abans de la taula", () => {
    expect(carrecs.map((c) => c.grup)).toEqual([
      "Tot per Terrassa",
      "Tot per Terrassa",
      "Junts per Terrassa",
      "Junts per Terrassa",
      "Partit Socialistes Terrassa",
      "Partit Socialistes Terrassa",
      "Esquerra Republicana de Terrassa",
      "Esquerra Republicana de Terrassa",
      "Partit Popular de Terrassa",
      "Partit Popular de Terrassa",
    ]);
  });

  it("sap qui governa perquè la pàgina separa l'«Oposició»", () => {
    expect(carrecs.slice(0, 4).every((c) => c.equipGovern === true)).toBe(true);
    expect(carrecs.slice(4).every((c) => c.equipGovern === false)).toBe(true);
  });

  it("no s'inventa qui governa si la pàgina no separa l'oposició", () => {
    const html = fixture("terrassa-consistori.html").replace("<strong>Oposició </strong>", "");
    expect(parseTerrassa(html).every((c) => c.equipGovern === undefined)).toBe(true);
  });

  it("qui no té enllaç de fitxa es queda sense fitxa, no amb el de l'agenda", () => {
    const carles = carrecs.find((c) => c.nom === "Carles Lázaro Hernando")!;
    expect(carles.fitxa).toBeNull();
    expect(carles.foto).toContain("Carles+L%C3%A1zaro+Hernando.jpg");
    expect(carrecs[0]!.fitxa).toBe("https://www.terrassa.cat/jordi-ballart-pastor");
  });

  it("amb la còpia de Chrome, la foto apunta a la carpeta _files i la clau no canvia", () => {
    /*
     * Chrome desa cada imatge amb l'últim tram de la URL —a Liferay, l'id de la
     * imatge— més l'extensió, i reescriu el `src`. La clau ha de sortir igual
     * que de la web, si no cada còpia nova refaria totes les miniatures.
     */
    const html = fixture("terrassa-consistori.html").replace(
      /src="\/documents\/[^"]*\/([0-9a-f-]{36})[^"]*"/g,
      'src="./Consistori - Ajuntament de Terrassa_files/$1.jpg"',
    );
    const desada = parseTerrassa(html, "file:///tmp/copies/terrassa/Consistori%20-%20Ajuntament%20de%20Terrassa.html");
    expect(desada[0]!.foto).toBe(
      "file:///tmp/copies/terrassa/Consistori%20-%20Ajuntament%20de%20Terrassa_files/5efeb063-171a-49b7-ad0a-a0affc19ab11.jpg",
    );
    expect(carrecs[0]!.fotoClau).toBe("terrassa/5efeb063-171a-49b7-ad0a-a0affc19ab11");
    expect(desada[0]!.fotoClau).toBe(carrecs[0]!.fotoClau);
    // Els enllaços de fitxa són de la web, encara que la còpia sigui al disc.
    expect(desada[0]!.fitxa).toBe("https://www.terrassa.cat/jordi-ballart-pastor");
  });

  it("el vet del nom: un retrat que no casa amb la casella no es desa", () => {
    // Si un dia la pàgina desplacés una fila, el retrat de sota seria d'un altre.
    const html = fixture("terrassa-consistori.html").replace(
      'alt="fotografia oficial Jordi Ballart alcalde"',
      'alt="fotografia oficial de Noel Duque regidor"',
    );
    const c = parseTerrassa(html);
    expect(c[0]!.nom).toBe("Jordi Ballart i Pastor");
    expect(c[0]!.foto).toBeNull();
    expect(c[0]!.fotoClau).toBeUndefined();
    expect(c[1]!.foto).not.toBeNull();
  });

  it("nomsCompatibles tolera els descuits reals de la pàgina i prou", () => {
    expect(nomsCompatibles("fotografia oficial de Patri Reche regidora", "Patrícia Reche Martínez")).toBe(true);
    expect(nomsCompatibles("Fotografia oficial de Ruth Ibernón", "Ruth Hibernón Martín")).toBe(true);
    expect(nomsCompatibles("fotografia oficial d'Alberto Muñoz regidor", "Alberto Muñoz Salmerón")).toBe(true);
    expect(nomsCompatibles("fotografia oficial de Marta Giméne regidora", "Marta Giménez Arcusa")).toBe(true);
    expect(nomsCompatibles("fotografia oficial de Noel Duque regidor", "Jordi Ballart i Pastor")).toBe(false);
    expect(nomsCompatibles("", "Jordi Ballart i Pastor")).toBe(false);
  });

  it("clauFotoTerrassa és l'id de Liferay, tant amb cache i sense extensió com a l'inrevés", () => {
    expect(
      clauFotoTerrassa(
        "/documents/12006/62063442/Jordi+Ballart+Pastor+TXT.jpg/5efeb063-171a-49b7-ad0a-a0affc19ab11?t=1687246991283",
      ),
    ).toBe("terrassa/5efeb063-171a-49b7-ad0a-a0affc19ab11");
    expect(clauFotoTerrassa("./Consistori - Ajuntament de Terrassa_files/5efeb063-171a-49b7-ad0a-a0affc19ab11.jpg")).toBe(
      "terrassa/5efeb063-171a-49b7-ad0a-a0affc19ab11",
    );
  });

  it("es queda sense res davant d'una pàgina sense la taula", () => {
    expect(parseTerrassa("<html><body><p>Just a moment...</p></body></html>")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("llicències", () => {
  it("Barcelona és l'única font oberta", () => {
    const obertes = Object.values(FONTS).filter((f) => f.llicencia === "oberta");
    expect(obertes.map((f) => f.municipi)).toEqual(["Barcelona"]);
    expect(obertes[0]!.citacio).toContain("Creative Commons Attribution 4.0");
  });

  it("cap font amb llicència declarada no es queda sense citació", () => {
    for (const font of Object.values(FONTS)) {
      if (font.llicencia === "sense-avis-legal") {
        expect(font.urlAvisLegal).toBeNull();
      } else {
        expect(font.citacio.length).toBeGreaterThan(0);
        expect(font.urlAvisLegal).toBeTruthy();
      }
    }
  });

  it("es nega a baixar Mataró abans de fer cap petició", async () => {
    // Si peta per un altre motiu, és que la comprovació ha arribat massa tard.
    await expect(fotosDe("Mataró")).rejects.toThrow(LlicenciaDenegadaError);
    await expect(fotosDe("Mataró")).rejects.toThrow(/Ajuntament de Mataró/);
  });

  it("no baixa res d'un municipi que no tenim declarat", async () => {
    await expect(fotosDe("Reus")).rejects.toThrow(/No hi ha cap font/);
  });

  it("Terrassa és l'única que necessita còpia desada, i sense còpia no fa cap petició", async () => {
    const tancades = Object.values(FONTS).filter((f) => f.nomesCopiaDesada);
    expect(tancades.map((f) => f.municipi)).toEqual(["Terrassa"]);
    expect(FONTS.Terrassa!.llicencia).toBe("no-comercial");
    await expect(fotosDe("Terrassa")).rejects.toThrow(CopiaDesadaAbsentError);
    await expect(fotosDe("Terrassa")).rejects.toThrow(/navegador/);
  });
});
