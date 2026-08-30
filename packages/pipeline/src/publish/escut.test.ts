import { describe, expect, it } from "vitest";
import {
  credit,
  deMunicipi,
  escutMunicipi,
  urlLlicencia,
  vistaMunicipi,
  ESCUT_CSS,
  type ImatgeMunicipi,
  type ImatgesMunicipi,
} from "./escut";

/**
 * Les dades d'aquests casos són les d'Abrera tal com J20 les va desar: l'escut
 * és un SVG CC BY-SA 4.0 sense autor declarat i la fotografia és de
 * «Comunicació Ajuntament d'Abrera», la mateixa llicència. Són els dos casos
 * que la llicència tracta diferent, i per això són els dos que hi ha aquí.
 */
const ESCUT: ImatgeMunicipi = {
  mena: "escut",
  cami: "/observatori/escuts/08001.svg",
  format: "svg",
  amplada: null,
  alcada: null,
  derivada: false,
  fitxer: "File:Escudo de Abrera (Barcelona).svg",
  pagina: "https://commons.wikimedia.org/wiki/File:Escudo_de_Abrera_(Barcelona).svg",
  llicencia: "cc-by-sa-4.0",
  llicenciaNom: "CC BY-SA 4.0",
  autor: null,
};

const VISTA: ImatgeMunicipi = {
  mena: "vista",
  cami: "/observatori/vistes/08001.webp",
  format: "webp",
  amplada: 1024,
  alcada: 682,
  derivada: true,
  fitxer: "File:Abrera-57.jpg",
  pagina: "https://commons.wikimedia.org/wiki/File:Abrera-57.jpg",
  llicencia: "cc-by-sa-4.0",
  llicenciaNom: "CC BY-SA 4.0",
  autor: "Comunicació Ajuntament d'Abrera",
};

const ABRERA: ImatgesMunicipi = { escut: ESCUT, vista: VISTA };

describe("deMunicipi", () => {
  it("apostrofa i contrau com el català demana", () => {
    expect(deMunicipi("Abrera")).toBe("d'Abrera");
    expect(deMunicipi("Barcelona")).toBe("de Barcelona");
    expect(deMunicipi("el Prat de Llobregat")).toBe("del Prat de Llobregat");
    expect(deMunicipi("els Prats de Rei")).toBe("dels Prats de Rei");
    expect(deMunicipi("la Bisbal d'Empordà")).toBe("de la Bisbal d'Empordà");
    expect(deMunicipi("les Borges Blanques")).toBe("de les Borges Blanques");
  });

  /** Davant d'apòstrof no hi ha contracció: «del'Hospitalet» no existeix. */
  it("no contrau davant de l'apòstrof", () => {
    expect(deMunicipi("l'Hospitalet de Llobregat")).toBe("de l'Hospitalet de Llobregat");
  });

  /** La «h» és muda: «d'Hostalets», no «de Hostalets». */
  it("apostrofa davant de hac", () => {
    expect(deMunicipi("Hostalets de Pierola")).toBe("d'Hostalets de Pierola");
  });
});

describe("urlLlicencia", () => {
  it("porta el nom de la llicència al seu text", () => {
    expect(urlLlicencia("cc-by-sa-4.0")).toBe("https://creativecommons.org/licenses/by-sa/4.0/");
    expect(urlLlicencia("cc-by-3.0")).toBe("https://creativecommons.org/licenses/by/3.0/");
    expect(urlLlicencia("cc0")).toBe("https://creativecommons.org/publicdomain/zero/1.0/");
  });

  /**
   * El domini públic no té cap text de llicència. Val més el nom sense enllaç
   * que un enllaç inventat que porti a una pàgina que no diu res d'aquest
   * fitxer.
   */
  it("no s'inventa cap enllaç per al domini públic", () => {
    expect(urlLlicencia("pd-old-100")).toBeNull();
    expect(urlLlicencia("public domain")).toBeNull();
  });
});

describe("credit", () => {
  /** Els quatre elements que la CC BY-SA 4.0 exigeix, tots quatre. */
  it("diu què és, qui, sota quina llicència i on és l'original", () => {
    const html = credit(VISTA);
    expect(html).toContain("Fotografia:");
    expect(html).toContain("Abrera-57.jpg");
    expect(html).toContain("Comunicació Ajuntament d'Abrera");
    expect(html).toContain("CC BY-SA 4.0");
    expect(html).toContain('href="https://creativecommons.org/licenses/by-sa/4.0/"');
    expect(html).toContain('href="https://commons.wikimedia.org/wiki/File:Abrera-57.jpg"');
  });

  /**
   * Sense autor no es calla: s'identifica l'obra pel fitxer i s'enllaça
   * l'origen, que és el que fa comprovable l'atribució. Passa a molts escuts.
   */
  it("cita igualment el fitxer i la llicència quan no hi ha autor", () => {
    const html = credit(ESCUT);
    expect(html).toContain("Escut:");
    expect(html).toContain("Escudo de Abrera (Barcelona).svg");
    expect(html).toContain("autoria no declarada");
    expect(html).toContain("CC BY-SA 4.0");
  });

  /** La còpia reduïda és una obra derivada i la llicència obliga a dir-ho. */
  it("admet que la fotografia és una còpia reduïda, i no ho diu de l'SVG", () => {
    expect(credit(VISTA)).toContain("reduïda per quivoto");
    expect(credit(ESCUT)).not.toContain("reduïda");
  });

  it("sense imatge no escriu res", () => {
    expect(credit(null)).toBe("");
  });
});

describe("escutMunicipi", () => {
  it("dibuixa l'escut amb text alternatiu i mida", () => {
    const html = escutMunicipi(ABRERA, { municipi: "Abrera" });
    expect(html).toContain('src="/observatori/escuts/08001.svg"');
    expect(html).toContain('alt="Escut d\'Abrera"');
    expect(html).toContain("--escut-mida:44px");
  });

  /**
   * 70 dels 947 municipis no tenen escut a Commons. Una silueta grisa als
   * seus llocs assenyalaria qui no en té sense afegir cap informació.
   */
  it("no dibuixa res quan no n'hi ha", () => {
    expect(escutMunicipi({ escut: null, vista: VISTA }, { municipi: "Abrera" })).toBe("");
    expect(escutMunicipi(null, { municipi: "Abrera" })).toBe("");
  });

  /** L'escut no és un enllaç: 44 px arran del titular no són cap destinació. */
  it("no converteix l'escut en enllaç", () => {
    expect(escutMunicipi(ABRERA, { municipi: "Abrera" })).not.toContain("<a ");
  });
});

describe("vistaMunicipi", () => {
  it("porta el crèdit enganxat a la imatge que descriu", () => {
    const html = vistaMunicipi(ABRERA, { municipi: "Abrera" });
    expect(html).toContain("<figure");
    expect(html).toContain('src="/observatori/vistes/08001.webp"');
    expect(html).toContain("credit-imatge");
    expect(html).toContain("Comunicació Ajuntament d'Abrera");
  });

  /** Sense mides el text de sota fa un salt quan arriba la imatge. */
  it("reserva l'espai amb les mides reals del fitxer", () => {
    const html = vistaMunicipi(ABRERA, { municipi: "Abrera" });
    expect(html).toContain('width="1024"');
    expect(html).toContain('height="682"');
  });

  /** No descrivim el que no hem mirat: l'alt diu de quin poble és i prou. */
  it("no s'inventa què hi surt", () => {
    expect(vistaMunicipi(ABRERA, { municipi: "Abrera" })).toContain('alt="Fotografia d\'Abrera"');
  });

  it("la primera imatge de la pàgina no es carrega mandrosament", () => {
    expect(vistaMunicipi(ABRERA, { municipi: "Abrera" })).toContain('loading="lazy"');
    expect(vistaMunicipi(ABRERA, { municipi: "Abrera", primerCop: true })).not.toContain("loading=");
  });

  it("no dibuixa res quan no hi ha fotografia", () => {
    expect(vistaMunicipi({ escut: ESCUT, vista: null }, { municipi: "Abrera" })).toBe("");
  });
});

describe("ESCUT_CSS", () => {
  /**
   * Un accent greu dins d'un template de CSS tanca la cadena i fa petar la
   * compilació. La regla del projecte és que allà hi van cometes baixes.
   */
  it("no porta cap accent greu", () => {
    expect(ESCUT_CSS).not.toContain("`");
  });

  it("defineix les tres peces que la pàgina necessita", () => {
    expect(ESCUT_CSS).toContain(".escut");
    expect(ESCUT_CSS).toContain(".vista");
    expect(ESCUT_CSS).toContain(".credit-imatge");
  });
});
