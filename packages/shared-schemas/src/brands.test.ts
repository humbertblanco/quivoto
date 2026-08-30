import { describe, expect, it } from "vitest";
import { resolveBrand, sameForce, siglesFamily } from "./brands";

describe("siglesFamily", () => {
  it("reconeix la mateixa força sota noms diferents al llarg dels anys", () => {
    // Els noms reals amb què el PSC ha guanyat Esplugues des del 1979.
    for (const sigles of ["PSC-PSOE", "PSC-PM", "PSC-CP", "PSC CP", "PSCPMC", "PSC-UNITS-CP"]) {
      expect(siglesFamily(sigles), sigles).toBe("psc");
    }
    expect(siglesFamily("CiU")).toBe("ciu");
    expect(siglesFamily("JxCAT-JUNTS")).toBe("junts");
    expect(siglesFamily("ERC-AM")).toBe("erc");
    expect(siglesFamily("ICV-EUiA")).toBe("comuns");
    expect(siglesFamily("CUP-PA")).toBe("cup");
  });

  it("no atribueix cap família a una llista local", () => {
    expect(siglesFamily("Gent de Capolat")).toBeNull();
    expect(siglesFamily("UxA")).toBeNull();
  });
});

describe("sameForce", () => {
  it("no compta una alternança quan només canvia el nom", () => {
    expect(sameForce("PSC-PSOE", "PSC-CP")).toBe(true);
    expect(sameForce("CiU", "CIU")).toBe(true);
    expect(sameForce("Independents per Móra", "Independents Móra")).toBe(true);
  });

  it("detecta un canvi de mans de veritat", () => {
    expect(sameForce("PSC-CP", "CiU")).toBe(false);
    expect(sameForce("ERC-AM", "JxCAT-JUNTS")).toBe(false);
    expect(sameForce("CUP-PA", "PP")).toBe(false);
  });

  it("davant del dubte no afirma que hi hagi hagut canvi", () => {
    expect(sameForce(null, "PSC")).toBe(true);
    expect(sameForce("PSC", undefined)).toBe(true);
  });

  it("CiU i Junts es compten com a forces diferents, que és el que van ser a les urnes", () => {
    expect(sameForce("CiU", "JxCAT-JUNTS")).toBe(false);
  });
});

describe("resolveBrand", () => {
  it("resol les agrupacions conegudes de cada elecció", () => {
    expect(resolveBrand("M20231", "20231127").brandId).toBe("erc");
    expect(resolveBrand("M20191", "2019839").brandId).toBe("erc");
    expect(resolveBrand("M20151", "2015012").brandId).toBe("ciu");
  });

  it("marca per revisar el que no coneix, en comptes d'endevinar-ho", () => {
    const unknown = resolveBrand("M20231", "999999");
    expect(unknown.brandId).toBe("local");
    expect(unknown.needsReview).toBe(true);
  });
});

describe("sameForce amb coalicions locals", () => {
  it("veu la marca amagada dins d'una coalició local", () => {
    // Casos reals de la composició dels plens del 2023.
    expect(sameForce("UA-PSC-CP", "PSC-CP")).toBe(true);
    expect(sameForce("SP-CUP-AM", "CUP-AMUNT")).toBe(true);
    expect(sameForce("ERC-EUiA-AM", "ERC / ESQUERRA")).toBe(true);
    expect(sameForce("JUNTS-CM", "CM")).toBe(true);
  });

  it("segueix distingint un canvi de bàndol real", () => {
    expect(sameForce("PSC-CP", "CM")).toBe(false);
    expect(sameForce("ERC-AM", "PP")).toBe(false);
  });

  it("no tria marca quan la coalició en barreja dues", () => {
    // «ERC-EUiA» apunta a dues famílies alhora: no n'afirmem cap.
    expect(siglesFamily("Gent-i-Poble")).toBeNull();
  });
});

describe("les coalicions «en comú», que porten la marca al mig", () => {
  it("reconeix la família encara que el nom comenci per la ciutat", () => {
    expect(siglesFamily("Barcelona en Comú-C")).toBe("comuns");
    expect(siglesFamily("BCN en Comú - C")).toBe("comuns");
  });

  it("no endevina les sigles que amaguen la marca dins d'un acrònim", () => {
    // «LHECP» és l'Hospitalet En Comú Podem, i no hi ha manera de saber-ho
    // sense una taula a mà. Val més no reconèixer-la que inventar-se una
    // regla que un dia atribuirà un regidor al partit que no toca.
    expect(siglesFamily("LHECP-C")).toBeNull();
  });

  it("i per tant les lliga entre elles", () => {
    expect(sameForce("Barcelona en Comú-C", "BCN en Comú - C")).toBe(true);
  });
});

/**
 * Sigles que es quedaven en gris a la llista dels 947 tot i ser una marca amb
 * color propi. Cadascuna ve d'un municipi concret, i el municipi hi consta
 * perquè qui les repassi pugui comprovar-ho a la font.
 */
describe("sigles que hi eren i no es reconeixien", () => {
  it("Junts escrit sencer, com a Tàrrega", () => {
    expect(siglesFamily("JuntsxCat")).toBe("junts");
    expect(siglesFamily("JxCat")).toBe("junts");
  });

  it("la Convergéncia Democratica Aranesa, com a Naut Aran", () => {
    expect(siglesFamily("CDA-PNA")).toBe("cda");
  });

  it("no s'inventa una família per a una llista local", () => {
    // «TxT» és Tot per Terrassa i no és cap marca supramunicipal: ha de
    // continuar sense família, que és el que la deixa en gris i no la pinta
    // del color d'un partit que no és el seu.
    expect(siglesFamily("TxT")).toBeNull();
    expect(siglesFamily("CANETENCS")).toBeNull();
    expect(siglesFamily("SOM VEU")).toBeNull();
  });
});

/**
 * Les etiquetes de coalició. Són tres i cadascuna és d'un partit: «-AM» és
 * l'Acord Municipal d'Esquerra, «-AMUNT» és de la CUP i «-CP» és la
 * Candidatura de Progrés del PSC. Dues ja es reconeixien i la tercera no, i
 * el resultat és que 33 alcaldies socialistes sortien sense color al mapa
 * mentre les altres dues el tenien.
 */
describe("les etiquetes de coalició, totes tres", () => {
  it("«-CP» és el PSC, com «-AM» és Esquerra", () => {
    expect(siglesFamily("SS-CP")).toBe("psc");
    expect(siglesFamily("CxB-CP")).toBe("psc");
    expect(siglesFamily("UPTA-CP")).toBe("psc");
    expect(siglesFamily("CP")).toBe("psc");
    expect(siglesFamily("ERC-AM")).toBe("erc");
  });

  it("no s'aplica a un tros que només comenci per cp", () => {
    // «CPT» no és cap candidatura de progrés: l'etiqueta és el tros sencer.
    expect(siglesFamily("CPT")).toBeNull();
  });
});

/**
 * Casos trobats repassant les 163 sigles que es quedaven sense color, i
 * cadascun amb el contraexemple que en fixa el límit. El límit és tan
 * important com el cas: «-TE» és Tots per l'Empordà com a sufix, però «TE-XTU»
 * de l'Espluga Calba no ho és, i pintar-lo seria un error.
 */
describe("sigles llargues i sufixos d'agrupació", () => {
  it("l'espai i la barra separen trossos, no s'esborren", () => {
    // «JUNTS PER RIALP CM» s'enganxava en un sol tros i no casava amb res.
    expect(siglesFamily("JUNTS PER RIALP CM")).toBe("junts");
    expect(siglesFamily("PLV/ERC")).toBe("erc");
    // Els punts sí que s'esborren: «F.I.C.» és un sol tros i no cap sigla.
    expect(siglesFamily("F.I.C.")).toBeNull();
  });

  it("els sufixos comarcals, només al final", () => {
    expect(siglesFamily("EA-IdSELVA")).toBe("idselva");
    expect(siglesFamily("TFS-TE")).toBe("te");
    expect(siglesFamily("TE-XTU")).toBeNull();
  });

  it("l'Acord Municipal escrit sencer és Esquerra, com ja ho és «-AM»", () => {
    expect(siglesFamily("VIU ESPOT-ACORD MUNICIPAL")).toBe("erc");
    expect(siglesFamily("ERC-AM")).toBe("erc");
  });
});

describe("els noms de dues paraules, amb separador i sense", () => {
  it("«ARA PL» és PDeCAT tant junt com separat", () => {
    expect(siglesFamily("ARA PL")).toBe("pdecat");
    expect(siglesFamily("ARAPL")).toBe("pdecat");
  });

  it("i el PSC en totes les seves formes", () => {
    expect(siglesFamily("PSC PSOE")).toBe("psc");
    expect(siglesFamily("PSC-PSOE")).toBe("psc");
    expect(siglesFamily("PSCPSOE")).toBe("psc");
  });
});

/**
 * Els dos acrònims que atribuïen un poble a un partit que no s'hi ha presentat.
 *
 * Es van trobar comparant les 2.626 candidatures del 2023 amb el `brand_id`
 * que en surt del codi d'agrupació electoral: de 2.194 casos on totes dues
 * coses diuen una família, només vuit no coincidien, i quatre eren d'aquests
 * dos patrons. Un acrònim curt ancorat només al davant no és un senyal.
 */
describe("els acrònims curts no poden manar sobre un tros de paraula", () => {
  it("«Cs» és Ciutadans; «CSLLM» i «CSJ» no ho són", () => {
    expect(siglesFamily("Cs")).toBe("cs");
    expect(siglesFamily("C's")).toBe("cs");
    expect(siglesFamily("Ciutadans")).toBe("cs");
    // Sant Llorenç de la Muga: l'«-AM» del final sí que és un senyal, i ara la
    // dona a Esquerra, que és el que en diu el codi d'agrupació.
    expect(siglesFamily("CSLLM-AM")).toBe("erc");
    // Sant Jaume dels Domenys es queda sense família, que és el que ha de
    // passar: el codi d'agrupació la dona al PDeCAT i és aquell qui la pinta,
    // no un acrònim que comença igual que un partit.
    expect(siglesFamily("CSJ-ARA PL")).toBeNull();
  });

  it("Aliança Catalana només quan s'escriu, i «AC» sol no ho és", () => {
    expect(siglesFamily("ALIANÇA.CAT")).toBe("aliancacat");
    // Copons: una llista d'electors que sortia pintada d'extrema dreta.
    expect(siglesFamily("AC")).toBeNull();
  });
});
