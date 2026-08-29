import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseCarrecs,
  senseTokenAuth,
  slugCandidates,
  titolMunicipi,
  urlCarrecs,
  urlFoto,
} from "./seue";

/**
 * El fixture és HTML real retallat de dues pàgines de seu-e: el primer grup de
 * Girona (dos càrrecs, tots dos amb foto) i un grup de Corbera de Llobregat on
 * hi ha un regidor **sense** fotografia. Aquesta barreja és el cas que importa:
 * és la que decideix si un municipi té cobertura completa o parcial.
 */
const html = readFileSync(join(__dirname, "__fixtures__", "carrecs-electes.html"), "utf8");

describe("parseCarrecs", () => {
  const carrecs = parseCarrecs(html);

  it("troba tots els càrrecs electes de la pàgina", () => {
    expect(carrecs).toHaveLength(4);
    expect(carrecs.map((c) => c.nom)).toEqual([
      "Lluc Salellas i Vilar",
      "Sergi Font Domènech",
      "JOAN MESTRE OLLER",
      "RAÜL JOSÉ JAIME BENAVIDES",
    ]);
  });

  it("llegeix el càrrec sencer, per llarg que sigui", () => {
    expect(carrecs[0]!.carrec).toBe("Alcalde");
    expect(carrecs[1]!.carrec).toBe(
      "2n Tinent d'alcaldia de l'Àrea de Transició Ecològica i Àrea Urbana i regidor d'Urbanisme",
    );
  });

  it("assigna cada càrrec al grup que el precedeix", () => {
    // El recompte «(8 càrrecs electes)» del <small> no forma part del nom.
    expect(carrecs[0]!.grup).toBe("Guanyem Girona (GGI - AMUNT)");
    expect(carrecs[1]!.grup).toBe("Guanyem Girona (GGI - AMUNT)");
    expect(carrecs[3]!.grup).toBe("Junts per Corbera - CM");
  });

  it("aparella foto i persona sense comparar noms", () => {
    expect(carrecs[0]!.fotoId).toBe(25009);
    expect(carrecs[1]!.fotoId).toBe(25105);
    expect(carrecs[2]!.fotoId).toBe(23959);
  });

  it("no confon el logotip del partit amb una fotografia", () => {
    // Aquest regidor no té foto: seu-e hi posa el `grupLogoImg` del seu partit.
    expect(carrecs[3]!.fotoId).toBeNull();
    expect(html).toContain("grupLogoImg");
  });

  it("guarda la fitxa de detall sense el token de sessió", () => {
    expect(carrecs[0]!.fitxa).toBe(
      "https://seu-e.cat/ca/web/girona/govern-obert-i-transparencia" +
        "/informacio-institucional-i-organitzativa/organitzacio-politica-i-retribucions" +
        "/carrecs-electes/-/grupPolitic/veureCarrec/25009",
    );
    expect(carrecs.every((c) => !c.fitxa?.includes("p_auth"))).toBe(true);
  });

  it("marca qui és a l'equip de govern", () => {
    expect(carrecs[0]!.equipGovern).toBe(true);
    expect(carrecs[3]!.equipGovern).toBe(false);
  });

  it("no peta amb una pàgina sense el mòdul", () => {
    // 486 dels 947 municipis tenen la pàgina però el mòdul buit.
    expect(parseCarrecs("<html><body><p>Cap càrrec</p></body></html>")).toEqual([]);
  });
});

describe("titolMunicipi", () => {
  it("treu el nom oficial del títol de la pàgina", () => {
    expect(titolMunicipi("<title>Càrrecs electes - Ajuntament de Girona</title>")).toBe(
      "Ajuntament de Girona",
    );
  });

  it("desescapa l'apòstrof, que seu-e escriu amb barra", () => {
    expect(titolMunicipi("<title>Càrrecs electes - Ajuntament de l\\'Albi</title>")).toBe(
      "Ajuntament de l'Albi",
    );
  });

  it("detecta la pàgina que no existeix", () => {
    expect(titolMunicipi("<title>Pàgina no trobada</title>")).toBe("Pàgina no trobada");
    expect(titolMunicipi("<html></html>")).toBeNull();
  });
});

describe("slugCandidates", () => {
  const primer = (nom: string) => slugCandidates(nom)[0];

  it("posa el cas normal al davant", () => {
    expect(primer("Girona")).toBe("girona");
    expect(primer("Corbera de Llobregat")).toBe("corberadellobregat");
  });

  it("prova primer sense article, que és el que fa seu-e", () => {
    expect(primer("l'Albi")).toBe("albi");
    expect(primer("els Alamús")).toBe("alamus");
    expect(primer("la Vall de Bianya")).toBe("valldebianya");
  });

  it("accepta el nom amb el prefix de la font", () => {
    expect(primer("Ajuntament de l'Hospitalet de Llobregat")).toBe("hospitaletdellobregat");
    expect(primer("Ajuntament dels Torms")).toBe("torms");
  });

  it("preveu que caiguin els guionets del topònim", () => {
    expect(slugCandidates("Vila-seca")).toContain("vilaseca");
    expect(slugCandidates("Torre-serona")).toContain("torreserona");
  });

  it("preveu el nom d'abans de la fusió", () => {
    // Els municipis fusionats conserven el slug antic.
    expect(slugCandidates("Calonge i Sant Antoni")).toContain("calonge");
    expect(slugCandidates("Bigues i Riells del Fai")).toContain("biguesiriells");
    expect(slugCandidates("Brunyola i Sant Martí Sapresa")).toContain("brunyola");
  });

  it("preveu el nom escapçat pel complement", () => {
    expect(slugCandidates("Cornellà de Llobregat")).toContain("cornella");
    expect(slugCandidates("Santa Llogaia d'Àlguema")).toContain("santallogaia");
  });

  it("no repeteix candidats", () => {
    const c = slugCandidates("Girona");
    expect(new Set(c).size).toBe(c.length);
  });
});

describe("URL", () => {
  it("munta el camí del mòdul de càrrecs", () => {
    expect(urlCarrecs("girona")).toBe(
      "https://seu-e.cat/ca/web/girona/govern-obert-i-transparencia" +
        "/informacio-institucional-i-organitzativa/organitzacio-politica-i-retribucions" +
        "/carrecs-electes",
    );
  });

  it("demana la foto pel slug del municipi a qui pertany", () => {
    // El carrecId és global, però amb un slug qualsevol la imatge respon 404.
    expect(urlFoto("girona", 25009)).toContain("/girona/");
    expect(urlFoto("girona", 25009)).toMatch(/getPhotoBytes\/25009$/);
  });

  it("treu el token de sessió, que el robots.txt prohibeix i a més caduca", () => {
    expect(senseTokenAuth("https://seu-e.cat/x?p_auth=3rIZdHDi")).toBe("https://seu-e.cat/x");
    expect(senseTokenAuth("https://seu-e.cat/x?a=1&p_auth=tok")).toBe("https://seu-e.cat/x?a=1");
  });
});
