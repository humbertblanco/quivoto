import { describe, expect, it } from "vitest";
import {
  accioDeCerca, ajuntament, catalegDeDades, conjuntDeDades, llistaOrdenada, llocsContinguts, mateixQue,
  a, ajuntamentLd, ambArticle, blocPreguntes, comarcaLd, cosPreguntes, delEns, enFrase, ensLd, GEO_CSS, ID, idDins,
  municipiLd, partitLd, personaLd, preguntesEns, preguntesLd, preguntesMunicipi, preguntesRapides, properesMunicipals,
  quartDiumengeDeMaig, textResposta, ultimaDespesaEns, urlWikidata,
  type FetsMunicipi, type PreguntaRapida,
} from "./seo-ld";
import { scriptJsonLd } from "./seo";
import type { DadesEns, MembreEns } from "./ens-tipus";

const M = "https://quivoto.cat/observatori/m/olot/";

describe("mateixQue", () => {
  it("deixa fora els buits i els repetits, i no torna cap llista buida", () => {
    expect(mateixQue("https://www.wikidata.org/wiki/Q1", null, undefined, "", "https://www.wikidata.org/wiki/Q1")).toEqual([
      "https://www.wikidata.org/wiki/Q1",
    ]);
    expect(mateixQue(null, undefined)).toBeUndefined();
  });
});

describe("l'ajuntament", () => {
  it("és una GovernmentOrganization amb la preposició ben escrita i l'alcaldia com a employee", () => {
    const org = ajuntament("Olot", M, { nom: "Agustí Arbós Torrent", carrec: "alcalde", url: `${M}regidor/agusti-arbos-torrent/` });
    expect(org["@type"]).toBe("GovernmentOrganization");
    expect(org.name).toBe("Ajuntament d'Olot");
    expect(org["@id"]).toBe(`${M}#ajuntament`);
    expect(org.areaServed).toEqual({ "@id": `${M}#municipi` });
    expect(org.employee).toEqual({
      "@type": "Person",
      name: "Agustí Arbós Torrent",
      jobTitle: "Alcalde d'Olot",
      url: `${M}regidor/agusti-arbos-torrent/`,
    });
  });
  it("sense alcaldia coneguda no escriu cap employee, i sense fitxa de la persona cap url", () => {
    expect(JSON.stringify(ajuntament("Reus", M, null))).not.toContain("employee");
    const org = ajuntament("El Prat de Llobregat", M, { nom: "Lluís Mijoler", carrec: "alcalde", url: null });
    expect(org.name).toBe("Ajuntament del Prat de Llobregat");
    expect(JSON.stringify(org)).not.toContain('"url":null');
  });
});

describe("la llista ordenada", () => {
  const llista = llistaOrdenada(
    "Participació a les municipals del 2023",
    [
      { nom: "Olot", url: M },
      { nom: "Reus", url: "https://quivoto.cat/observatori/m/reus/" },
    ],
    { url: "https://quivoto.cat/observatori/ranquings/#participacio", total: 947 },
  );
  it("numera des d'1, apunta a la pàgina de cada element i diu la mida sencera", () => {
    expect(llista["@type"]).toBe("ItemList");
    expect(llista.numberOfItems).toBe(947);
    expect(llista.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Olot", url: M },
      { "@type": "ListItem", position: 2, name: "Reus", url: "https://quivoto.cat/observatori/m/reus/" },
    ]);
    // Un fragment no pot portar un altre «#»: el nom del node s'hi enganxa amb un guió.
    expect(llista["@id"]).toBe("https://quivoto.cat/observatori/ranquings/#participacio-llista");
  });
  it("sense total, la mida és la de la llista", () => {
    expect(llistaOrdenada("x", [{ nom: "a", url: "u" }]).numberOfItems).toBe(1);
  });
});

describe("els llocs continguts", () => {
  it("són City amb nom i fitxa, i cap propietat quan no n'hi ha", () => {
    expect(llocsContinguts([{ nom: "Olot", url: M }])).toEqual([{ "@type": "City", name: "Olot", url: M }]);
    expect(llocsContinguts([])).toBeUndefined();
  });
});

describe("l'acció de cerca", () => {
  it("apunta a la mateixa pàgina amb ?q= i el mateix nom de paràmetre a query-input", () => {
    const a = accioDeCerca("https://quivoto.cat/observatori/");
    expect(a).toEqual({
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: "https://quivoto.cat/observatori/?q={cerca}" },
      "query-input": "required name=cerca",
    });
  });
});

describe("el conjunt de dades", () => {
  const url = "https://quivoto.cat/observatori/dades/";
  const d = conjuntDeDades({
    url,
    id: "dataset",
    nom: "Indicadors dels 947 municipis",
    descripcio: "Una fila per municipi.",
    fitxers: [
      { url: `${url}catalunya.csv`, format: "text/csv" },
      { url: `${url}catalunya.json`, format: "application/json" },
    ],
    llicencia: "https://creativecommons.org/licenses/by/4.0/",
    fonts: ["https://www.idescat.cat/", "https://www.idescat.cat/", "https://dadesobertes.seu-e.cat/"],
    dataModificacio: "2026-09-03",
    cataleg: `${url}#cataleg`,
    paraulesClau: ["municipis", "Catalunya"],
  });
  it("és un Dataset amb un DataDownload per fitxer, la llicència, les fonts sense repetir i el catàleg", () => {
    expect(d["@type"]).toBe("Dataset");
    expect(d["@id"]).toBe(`${url}#dataset`);
    expect(d.distribution).toEqual([
      { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${url}catalunya.csv` },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${url}catalunya.json` },
    ]);
    expect(d.isBasedOn).toEqual(["https://www.idescat.cat/", "https://dadesobertes.seu-e.cat/"]);
    expect(d.includedInDataCatalog).toEqual({ "@id": `${url}#cataleg` });
    expect(d.creator).toEqual({ "@id": "https://quivoto.cat/#organitzacio" });
    expect(d.spatialCoverage).toEqual({ "@type": "Place", name: "Catalunya" });
    expect(d.dateModified).toBe("2026-09-03");
  });
  it("dins d'una adreça amb fragment, l'@id no porta dos coixinets; i els camps van a variableMeasured", () => {
    const r = conjuntDeDades({ url: `${url}#fonts`, id: "registre", nom: "x", descripcio: "x", fitxers: [], llicencia: "l", variables: ["deute", "deute"] });
    expect(r["@id"]).toBe(`${url}#fonts-registre`);
    expect(r.variableMeasured).toEqual(["deute"]);
  });
  it("no escriu propietats buides", () => {
    const json = JSON.stringify(conjuntDeDades({ url, id: "x", nom: "x", descripcio: "x", fitxers: [], llicencia: "l" }));
    expect(json).not.toContain("isBasedOn");
    expect(json).not.toContain("temporalCoverage");
    expect(json).not.toContain("keywords");
    expect(json).not.toContain("null");
  });
  it("el catàleg lliga els conjunts per l'@id", () => {
    const c = catalegDeDades(url, "Dades obertes", "x", [`${url}#dataset`]);
    expect(c["@type"]).toBe("DataCatalog");
    expect(c.dataset).toEqual([{ "@id": `${url}#dataset` }]);
  });
  it("dins d'un script, porta el context una sola vegada", () => {
    const script = scriptJsonLd(d);
    expect(script.match(/@context/g)).toHaveLength(1);
  });
});

const OBS = "https://quivoto.cat/observatori";

describe("els @id del graf", () => {
  it("són sempre l'adreça de la pàgina de la cosa més el que és", () => {
    expect(ID.municipi("olot")).toBe(`${OBS}/m/olot/#municipi`);
    expect(ID.ajuntament("olot")).toBe(`${OBS}/m/olot/#ajuntament`);
    expect(ID.persona(`${OBS}/m/olot/regidor/anna-x/`)).toBe(`${OBS}/m/olot/regidor/anna-x/#persona`);
    expect(ID.partit("erc")).toBe(`${OBS}/partit/erc/#partit`);
    expect(ID.comarca("garrotxa")).toBe(`${OBS}/c/garrotxa/#comarca`);
    expect(ID.ens("diputacio", "girona")).toBe(`${OBS}/diputacio/girona/#ens`);
    expect(ID.ens("consell", "garrotxa")).toBe(`${OBS}/c/garrotxa/consell/#ens`);
  });
  it("idDins no encadena fragments, i urlWikidata accepta un QID o una adreça", () => {
    expect(idDins("https://x.cat/a/", "llista")).toBe("https://x.cat/a/#llista");
    expect(idDins("https://x.cat/a/#b", "llista")).toBe("https://x.cat/a/#b-llista");
    expect(urlWikidata("Q15495")).toBe("https://www.wikidata.org/wiki/Q15495");
    expect(urlWikidata("https://www.wikidata.org/wiki/Q1")).toBe("https://www.wikidata.org/wiki/Q1");
    expect(urlWikidata("no és res")).toBeNull();
    expect(urlWikidata(null)).toBeNull();
  });
});

describe("el municipi i l'ajuntament amb el graf", () => {
  it("el municipi porta Wikidata, Viquipèdia, el codi INE i la comarca pel seu @id", () => {
    const m = municipiLd({
      slug: "olot", nom: "Olot", comarca: { slug: "garrotxa", nom: "Garrotxa" }, ine: "17114", wikidata: "Q15495",
      viquipedia: "https://ca.wikipedia.org/wiki/Olot", punt: { lat: 42.18, lon: 2.49 }, habitants: 37000,
    });
    expect(m["@type"]).toBe("City");
    expect(m["@id"]).toBe(`${OBS}/m/olot/#municipi`);
    expect(m.sameAs).toEqual(["https://www.wikidata.org/wiki/Q15495", "https://ca.wikipedia.org/wiki/Olot"]);
    expect(m.identifier).toEqual({ "@type": "PropertyValue", propertyID: "INE", value: "17114" });
    expect(m.containedInPlace).toEqual({ "@type": "AdministrativeArea", "@id": `${OBS}/c/garrotxa/#comarca`, name: "Garrotxa", url: `${OBS}/c/garrotxa/` });
  });
  it("sense Wikidata ni comarca no escriu cap propietat buida", () => {
    const json = JSON.stringify(municipiLd({ slug: "x", nom: "X", comarca: null }));
    expect(json).not.toContain("sameAs");
    expect(json).not.toContain("identifier");
    expect(json).not.toContain("null");
    expect(json).toContain('"name":"Catalunya"');
  });
  it("l'alcaldia de l'ajuntament porta l'@id de la seva fitxa", () => {
    const url = `${OBS}/m/prat-de-llobregat/regidor/lluis-mijoler/`;
    const org = ajuntamentLd("prat-de-llobregat", "el Prat de Llobregat", { nom: "Lluís Mijoler", carrec: "alcalde", url });
    expect(org.name).toBe("Ajuntament del Prat de Llobregat");
    expect(org.areaServed).toEqual({ "@type": "City", "@id": `${OBS}/m/prat-de-llobregat/#municipi`, name: "el Prat de Llobregat" });
    expect((org.employee as Record<string, unknown>)["@id"]).toBe(`${url}#persona`);
    expect((org.employee as Record<string, unknown>).jobTitle).toBe("Alcalde del Prat de Llobregat");
  });
});

describe("la persona, el partit i la comarca", () => {
  const url = `${OBS}/m/bellcaire-d-urgell/regidor/jofre-de-juan/`;
  it("la persona diu de quin poble és el càrrec i treballa a l'ajuntament pel seu @id", () => {
    const p = personaLd({
      url, nom: "Jofre de Juan i Delberghe", carrec: "1r Tinent d'Alcalde", municipi: { slug: "bellcaire-d-urgell", nom: "Bellcaire d'Urgell" },
      partit: { id: "erc", nom: "Esquerra Republicana" }, sameAs: ["https://www.wikidata.org/wiki/Q1", null], foto: "../../../cares/x.jpg",
    });
    expect(p["@id"]).toBe(`${url}#persona`);
    expect(p.jobTitle).toBe("1r Tinent d'Alcalde de Bellcaire d'Urgell");
    expect(p.worksFor).toEqual({
      "@type": "GovernmentOrganization", "@id": `${OBS}/m/bellcaire-d-urgell/#ajuntament`,
      name: "Ajuntament de Bellcaire d'Urgell", url: `${OBS}/m/bellcaire-d-urgell/`,
    });
    expect(p.memberOf).toEqual({ "@type": "PoliticalParty", "@id": `${OBS}/partit/erc/#partit`, name: "Esquerra Republicana", url: `${OBS}/partit/erc/` });
    expect(p.sameAs).toEqual(["https://www.wikidata.org/wiki/Q1"]);
    expect(p.image).toBe(`${OBS}/m/cares/x.jpg`);
  });
  it("una llista local no és cap partit, i un càrrec que ja diu el poble no el repeteix", () => {
    const p = personaLd({ url, nom: "X", carrec: "Alcaldessa de Bellcaire d'Urgell", municipi: { slug: "b", nom: "Bellcaire d'Urgell" }, grup: "CM" });
    expect(p.memberOf).toEqual({ "@type": "Organization", name: "CM" });
    expect(p.jobTitle).toBe("Alcaldessa de Bellcaire d'Urgell");
    expect(JSON.stringify(p)).not.toContain("sameAs");
  });
  it("el partit és un PoliticalParty, i la comarca porta els municipis pel seu @id", () => {
    const pt = partitLd({ id: "erc", nom: "Esquerra Republicana de Catalunya", sigles: "ERC" });
    expect(pt["@type"]).toBe("PoliticalParty");
    expect(pt.alternateName).toBe("ERC");
    const c = comarcaLd({ slug: "garrotxa", nom: "Garrotxa", municipis: [{ slug: "olot", nom: "Olot" }] });
    expect(c["@id"]).toBe(`${OBS}/c/garrotxa/#comarca`);
    expect(c.containsPlace).toEqual([{ "@type": "City", "@id": `${OBS}/m/olot/#municipi`, name: "Olot", url: `${OBS}/m/olot/` }]);
    expect(JSON.stringify(comarcaLd({ slug: "x", nom: "X", municipis: [] }))).not.toContain("containsPlace");
  });
});

function membre(over: Partial<MembreEns> = {}): MembreEns {
  return {
    nom: "MARTA PUIG SERRA", carrec: "Diputada", rol: "membre", ordre: null, partit: "PSC-CP", partitFont: "ens",
    municipi: { slug: "manresa", nom: "Manresa" }, municipiFont: "registre", alcaldia: false, adreca: null, foto: null,
    retribucio: null, grup: "PSC", color: null, ...over,
  };
}

function ens(over: Partial<DadesEns> = {}): DadesEns {
  return {
    tipus: "diputacio", codiEns: "8000840003", nom: "Diputació de Barcelona", territori: "Barcelona", article: null,
    cif: "P0800000B", gerent: null, municat: null, web: "https://www.diba.cat/", seients: 51, membres: [], finances: null,
    districtes: null, wikidata: "Q1607008", escut: null, fonts: [], avisos: [], consultat: "2026-10-27", slug: "barcelona",
    seu: { slug: "barcelona", nom: "Barcelona" }, composicio: [], presidencia: null, municipis: [], poblacio: null,
    comarca: null, comarques: [], repartiment: null, subvencions: null, ...over,
  };
}

const presidenta = membre({
  nom: "LLUÏSA MORET SABIDÓ", carrec: "Presidenta", rol: "presidencia", alcaldia: true,
  municipi: { slug: "sant-boi-de-llobregat", nom: "Sant Boi de Llobregat" }, adreca: "regidor/lluisa-moret-sabido/",
  retribucio: { anualBrut: 104000, dedicacio: "dedicació exclusiva", sostreAssistencies: null, motiu: null,
    font: { nom: "Diputació de Barcelona, retribucions", url: "https://www.diba.cat/x", llicencia: null, consultat: "2026-10-20" } },
});

describe("la diputació i el consell com a organitzacions", () => {
  it("la diputació serveix la província, té la presidència com a employee i el ple a member, sense els seients sense nom", () => {
    const d = ens({ presidencia: presidenta, membres: [presidenta, membre(), membre({ nom: "  " })] });
    const o = ensLd(d);
    expect(o["@id"]).toBe(`${OBS}/diputacio/barcelona/#ens`);
    expect(o.areaServed).toEqual({ "@type": "AdministrativeArea", name: "província de Barcelona" });
    expect(o.sameAs).toEqual(["https://www.diba.cat/", "https://www.wikidata.org/wiki/Q1607008"]);
    const president = o.employee as Record<string, unknown>;
    expect(president.name).toBe("Lluïsa Moret Sabidó");
    expect(president.jobTitle).toBe("Presidenta de la Diputació de Barcelona");
    expect(president["@id"]).toBe(`${OBS}/m/sant-boi-de-llobregat/regidor/lluisa-moret-sabido/#persona`);
    const ple = o.member as Record<string, unknown>[];
    expect(ple).toHaveLength(2);
    expect(ple[1]).toEqual({ "@type": "OrganizationRole", roleName: "Diputada", member: { "@type": "Person", name: "Marta Puig Serra", jobTitle: "Diputada de la Diputació de Barcelona" } });
    expect(JSON.stringify(o)).not.toContain("parentOrganization");
  });
  it("el consell serveix la comarca pel seu @id, i sense noms no hi ha member", () => {
    const c = ens({ tipus: "consell", nom: "Consell Comarcal del Bages", territori: "Bages", slug: "bages", comarca: { slug: "bages", nom: "Bages" }, wikidata: null, web: null });
    const o = ensLd(c);
    expect(o["@id"]).toBe(`${OBS}/c/bages/consell/#ens`);
    expect(o.areaServed).toEqual({ "@type": "AdministrativeArea", "@id": `${OBS}/c/bages/#comarca`, name: "Bages", url: `${OBS}/c/bages/` });
    expect(JSON.stringify(o)).not.toContain('"member"');
    expect(ambArticle(c)).toBe("el Consell Comarcal del Bages");
    expect(delEns(c)).toBe("del Consell Comarcal del Bages");
    expect(delEns(ens())).toBe("de la Diputació de Barcelona");
  });
});

describe("les properes municipals", () => {
  it("són el quart diumenge de maig del cicle del 2023", () => {
    expect(quartDiumengeDeMaig(2019)).toBe("2019-05-26");
    expect(quartDiumengeDeMaig(2023)).toBe("2023-05-28");
    expect(quartDiumengeDeMaig(2027)).toBe("2027-05-23");
    expect(properesMunicipals("2026-10-27")).toBe("2027-05-23");
    expect(properesMunicipals("2027-05-23")).toBe("2027-05-23");
    // L'endemà de votar, la resposta ja és la del 2031.
    expect(properesMunicipals("2027-05-24")).toBe("2031-05-25");
    expect(properesMunicipals("2023-01-10")).toBe("2023-05-28");
  });
});

describe("les preguntes ràpides d'un municipi", () => {
  const fets = (over: Partial<FetsMunicipi> = {}): FetsMunicipi => ({
    municipi: "Sabadell",
    alcaldia: { nom: "Marta Farrés Falgueras", carrec: "alcaldessa", sigles: "PSC-CP", url: `${OBS}/m/sabadell/regidor/marta-farres-falgueras/` },
    govern: { sigles: "PSC-CP", regidories: 15, majoriaAbsoluta: true, mesVotada: "PSC-CP" },
    ple: { regidories: 27, majoria: 14 },
    participacio: { any: 2023, votants: 82345, cens: 160000 },
    habitants: { valor: 216520, any: 2024 },
    consultat: "2026-10-27",
    ...over,
  });

  it("fa les sis preguntes amb la dada, la font i la data a cada resposta", () => {
    const p = preguntesMunicipi(fets());
    expect(p.map((x) => x.pregunta)).toEqual([
      "Qui és l'alcaldessa de Sabadell?",
      "Quin partit governa Sabadell?",
      "Quants regidors té l'Ajuntament de Sabadell?",
      "Quan són les properes eleccions municipals a Sabadell?",
      "Quanta gent va votar a Sabadell a les municipals del 2023?",
      "Quants habitants té Sabadell?",
    ]);
    expect(p[0]!.resposta).toBe("L'alcaldessa de Sabadell és Marta Farrés Falgueras (PSC-CP).");
    expect(p[0]!.quan).toBe("dades del 27 d'octubre del 2026");
    expect(p[1]!.resposta).toBe("A Sabadell governa PSC-CP amb majoria absoluta: 15 de les 27 regidories del ple.");
    expect(p[2]!.resposta).toContain("El ple de Sabadell té 27 regidories, i la majoria absoluta és de 14.");
    expect(p[3]!.resposta).toContain("el diumenge 23 de maig del 2027");
    expect(p[4]!.resposta).toBe(
      "A les municipals del 2023, a Sabadell hi van votar 82.345 de les 160.000 persones del cens electoral: una participació del 51,5 %.",
    );
    expect(p[5]!.resposta).toBe("Sabadell té 216.520 habitants, segons el padró del 2024.");
    expect(p.every((x) => x.font !== null)).toBe(true);
    expect(textResposta(p[0]!)).toMatch(/^L'alcaldessa de Sabadell és .*\. Font: Composició dels plens municipals \(Generalitat de Catalunya\), dades del 27 d'octubre del 2026\.$/);
  });

  it("contrau l'article del nom, i sense el càrrec curt pregunta sense gènere", () => {
    const p = preguntesMunicipi(fets({
      municipi: "El Prat de Llobregat",
      alcaldia: { nom: "Lluís Mijoler", carrec: null, sigles: null },
      govern: { sigles: "EPCP-C", regidories: 12, majoriaAbsoluta: false, mesVotada: "PSC-CP" },
      ple: { regidories: 25, majoria: 13 },
    }));
    expect(p[0]!.pregunta).toBe("Qui té l'alcaldia del Prat de Llobregat?");
    expect(p[0]!.resposta).toBe("L'alcaldia del Prat de Llobregat la té Lluís Mijoler.");
    expect(p[1]!.pregunta).toBe("Quin partit governa el Prat de Llobregat?");
    expect(p[1]!.resposta).toBe(
      "Al Prat de Llobregat governa EPCP-C sense majoria absoluta: 12 de les 25 regidories del ple. La llista més votada a les municipals del 2023 va ser PSC-CP.",
    );
    expect(p[3]!.pregunta).toBe("Quan són les properes eleccions municipals al Prat de Llobregat?");
    expect(p[5]!.resposta.startsWith("El Prat de Llobregat té")).toBe(true);
    expect(enFrase("Els Omells de na Gaia")).toBe("els Omells de na Gaia");
    expect(a("els Omells de na Gaia")).toBe("als Omells de na Gaia");
  });

  it("un buit no es converteix en pregunta: sense dades només queda la de les eleccions", () => {
    const p = preguntesMunicipi({ municipi: "Reus", alcaldia: null, govern: null, ple: null, participacio: null, habitants: { valor: 100, any: null }, consultat: "2026-10-27" });
    expect(p).toHaveLength(1);
    expect(p[0]!.pregunta).toBe("Quan són les properes eleccions municipals a Reus?");
    // Una participació impossible (més votants que cens) tampoc no es diu.
    expect(preguntesMunicipi(fets({ participacio: { any: 2023, votants: 10, cens: 5 } })).some((x) => x.pregunta.startsWith("Quanta gent"))).toBe(false);
  });
});

describe("les preguntes ràpides d'un ens", () => {
  const capitols = [
    { tipus: "despeses" as const, capitol: 1, nom: "Personal", liquidat: 300_000_000, pressupostat: null },
    { tipus: "despeses" as const, capitol: 2, nom: "Béns", liquidat: null, pressupostat: null },
    { tipus: "despeses" as const, capitol: 4, nom: "Transferències", liquidat: 112_300_000, pressupostat: null },
    { tipus: "ingressos" as const, capitol: 4, nom: "Transferències", liquidat: 999_000_000, pressupostat: null },
  ];
  const d = ens({
    presidencia: presidenta, membres: [presidenta], poblacio: 5_000_000,
    finances: { anys: [{ any: 2023, capitols: [] }, { any: 2024, capitols }], programes: null, deute: [{ any: 2023, deuteViu: 10 }, { any: 2024, deuteViu: 2_500_000 }], fonts: [] },
  });

  it("presideix, quants són, com s'escullen, quant gasta, quant cobra i quant deu", () => {
    const p = preguntesEns(d);
    expect(p.map((x) => x.pregunta)).toEqual([
      "Qui presideix la Diputació de Barcelona?",
      "Quants diputats té la Diputació de Barcelona?",
      "Com s'escullen els diputats de la Diputació de Barcelona?",
      "Quant gasta la Diputació de Barcelona?",
      "Quant cobra la presidència de la Diputació de Barcelona?",
      "Quant deu la Diputació de Barcelona?",
    ]);
    expect(p[0]!.resposta).toBe("La Diputació de Barcelona la presideix Lluïsa Moret Sabidó (PSC-CP), que té l'alcaldia de Sant Boi de Llobregat.");
    expect(p[0]!.enllac).toEqual({ text: "Lluïsa Moret Sabidó", url: `${OBS}/m/sant-boi-de-llobregat/regidor/lluisa-moret-sabido/` });
    expect(p[1]!.resposta).toContain("té 51 diputats");
    expect(p[2]!.resposta).toContain("D'Hondt");
    // Els capítols sense import no compten com a zero; els ingressos no hi entren.
    expect(p[3]!.resposta).toBe("El 2024, la Diputació de Barcelona va liquidar 412,3 milions d'euros de despesa, uns 82 € per habitant de la demarcació.");
    expect(p[4]!.resposta).toContain("104.000 € bruts l'any per presidir la Diputació de Barcelona, amb dedicació exclusiva");
    expect(p[4]!.quan).toBe("dades del 20 d'octubre del 2026");
    expect(p[5]!.resposta).toBe("A 31 de desembre del 2024, la Diputació de Barcelona tenia un deute viu de 2,5 milions d'euros.");
    expect(ultimaDespesaEns(ens())).toBeNull();
  });

  it("el consell «el presideix», i sense presidència, sous ni diners queden les dues de la llei", () => {
    const c = ens({ tipus: "consell", nom: "Consell Comarcal del Bages", slug: "bages", seients: 33, presidencia: membre({ carrec: "President", rol: "presidencia", municipi: null }) });
    const p = preguntesEns(c);
    expect(p[0]!.resposta).toBe("El Consell Comarcal del Bages el presideix Marta Puig Serra (PSC-CP).");
    expect(p[1]!.resposta).toContain("Decret legislatiu 4/2003");
    expect(p[2]!.resposta).toContain("3 % dels vots");
    expect(p).toHaveLength(3);
    const sense = preguntesEns(ens({ seients: 0 }));
    expect(sense.map((x) => x.pregunta)).toEqual(["Com s'escullen els diputats de la Diputació de Barcelona?"]);
    // Un sou de zero no és cap resposta a «quant cobra».
    const zero = membre({ ...presidenta, retribucio: { ...presidenta.retribucio!, anualBrut: 0 } });
    expect(preguntesEns(ens({ presidencia: zero })).some((x) => x.pregunta.startsWith("Quant cobra"))).toBe(false);
  });
});

describe("el bloc visible i el FAQPage diuen el mateix", () => {
  const preguntes: PreguntaRapida[] = [
    { pregunta: "Qui és l'alcalde d'Olot?", resposta: "L'alcalde d'Olot és Agustí <Arbós>.", font: { nom: "Plens", url: "https://x.cat/" }, quan: "dades del 27 d'octubre del 2026", enllac: { text: "Agustí <Arbós>", url: `${OBS}/m/olot/regidor/a/` } },
    { pregunta: "Quan?", resposta: "El 2027.", font: null, quan: null },
  ];
  it("el FAQPage porta el text sencer, amb la font, i l'@id de la pàgina", () => {
    const ld = preguntesLd(preguntes, `${OBS}/m/olot/`);
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld["@id"]).toBe(`${OBS}/m/olot/#pagina`);
    expect((ld.mainEntity as { acceptedAnswer: { text: string } }[])[0]!.acceptedAnswer.text).toBe(
      "L'alcalde d'Olot és Agustí <Arbós>. Font: Plens, dades del 27 d'octubre del 2026.",
    );
  });
  it("el bloc escapa el text, enllaça el nom i porta la font a sota", () => {
    const html = blocPreguntes(preguntes);
    expect(html).toContain('<section class="bloc geo-preguntes" id="preguntes-rapides" aria-labelledby="preguntes-rapides-titol">');
    expect(html).toContain("<h2 id=\"preguntes-rapides-titol\">Preguntes ràpides</h2>");
    expect(html).toContain(`L'alcalde d'Olot és <a href="${OBS}/m/olot/regidor/a/">Agustí &lt;Arbós&gt;</a>.`);
    expect(html).toContain('<p class="geo-font">Font: <a href="https://x.cat/" rel="noopener">Plens</a>, dades del 27 d\'octubre del 2026.</p>');
    expect(html).not.toContain("<Arbós>");
    expect(cosPreguntes([])).toBe("");
    expect(blocPreguntes([])).toBe("");
  });
  it("preguntesRapides torna les dues meitats, o res", () => {
    expect(preguntesRapides([], "u")).toEqual({ html: "", cos: "", jsonLd: null });
    const r = preguntesRapides(preguntes, `${OBS}/m/olot/`, { id: "rapides" });
    expect(r.html).toContain('id="rapides"');
    expect(r.jsonLd?.["@type"]).toBe("FAQPage");
  });
  it("el full només té classes geo-", () => {
    const selectors = GEO_CSS.replace(/@media[^{]*\{/g, "").match(/[^{}]+(?=\{)/g)!.map((s) => s.trim()).filter(Boolean);
    expect(selectors.length).toBeGreaterThan(5);
    expect(selectors.every((s) => s.split(",").every((p) => p.trim().startsWith(".geo-llista")))).toBe(true);
  });
});
