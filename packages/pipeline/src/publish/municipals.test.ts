import { describe, expect, it } from "vitest";
import { councilSeats, dHondt } from "@quivoto/shared-schemas/seats";
import {
  calendariMunicipals,
  dataFita,
  DIA_MUNICIPALS_2027,
  diaSetmana,
  EXEMPLE_DHONDT,
  MUNICIPALS_CSS,
  notaDHondt,
  preguntesMunicipals,
  renderMunicipals,
  resolExempleDHondt,
  sumaDies,
  tramsRegidories,
} from "./municipals";

/**
 * Les dates d'aquesta pàgina no s'han escrit a mà: surten dels terminis de la
 * LOREG comptats des del dia de votar. La prova que el càlcul és bo és el 2023,
 * que ja va passar i té un decret al BOE (Reial decret 207/2023, de 3 d'abril,
 * publicat el 4): les mateixes regles han de donar les dates que es van viure.
 */
describe("calendariMunicipals", () => {
  const fita = (cal: ReturnType<typeof calendariMunicipals>, id: string) => cal.find((f) => f.id === id)!;

  it("el 2027 es vota el diumenge 23 de maig", () => {
    expect(DIA_MUNICIPALS_2027).toBe("2027-05-23");
    expect(diaSetmana(DIA_MUNICIPALS_2027)).toBe("diumenge");
  });

  it("reprodueix el calendari del 2023 (RD 207/2023)", () => {
    const cal = calendariMunicipals("2023-05-28");
    expect(fita(cal, "convocatoria").des).toBe("2023-04-04");
    expect(fita(cal, "cens")).toMatchObject({ des: "2023-04-10", fins: "2023-04-17" });
    expect(fita(cal, "candidatures")).toMatchObject({ des: "2023-04-19", fins: "2023-04-24" });
    expect(fita(cal, "proclamacio").des).toBe("2023-05-01");
    expect(fita(cal, "campanya")).toMatchObject({ des: "2023-05-12", fins: "2023-05-26" });
    expect(fita(cal, "correu-demana").fins).toBe("2023-05-18");
    expect(fita(cal, "correu-envia").des).toBe("2023-05-24");
    expect(fita(cal, "ple").des).toBe("2023-06-17");
  });

  it("dona les dates previstes del 2027", () => {
    const cal = calendariMunicipals();
    expect(fita(cal, "convocatoria").des).toBe("2027-03-30");
    expect(fita(cal, "cens")).toMatchObject({ des: "2027-04-05", fins: "2027-04-12" });
    expect(fita(cal, "candidatures")).toMatchObject({ des: "2027-04-14", fins: "2027-04-19" });
    expect(fita(cal, "proclamacio").des).toBe("2027-04-26");
    expect(fita(cal, "campanya")).toMatchObject({ des: "2027-05-07", fins: "2027-05-21" });
    expect(diaSetmana("2027-05-21")).toBe("divendres");
    expect(fita(cal, "correu-demana").fins).toBe("2027-05-13");
    expect(fita(cal, "correu-envia").des).toBe("2027-05-19");
    expect(fita(cal, "reflexio").des).toBe("2027-05-22");
    expect(fita(cal, "ple").des).toBe("2027-06-12");
  });

  it("la campanya dura quinze dies i les fites van en ordre", () => {
    const cal = calendariMunicipals();
    const campanya = fita(cal, "campanya");
    expect(sumaDies(campanya.des, 14)).toBe(campanya.fins);
    const dates = cal.map((f) => f.des);
    expect(dates).toEqual([...dates].sort());
  });

  it("escriu els trams com es diuen", () => {
    expect(dataFita({ des: "2027-04-05", fins: "2027-04-12" })).toBe("del 5 al 12 d'abril del 2027");
    expect(dataFita({ des: "2027-04-01", fins: "2027-04-11" })).toBe("de l'1 al 11 d'abril del 2027");
    expect(dataFita({ des: "2027-03-30", fins: "2027-05-13" })).toBe("del 30 de març del 2027 al 13 de maig del 2027");
    expect(dataFita({ des: "2027-05-23", fins: "2027-05-23" })).toBe("diumenge 23 de maig del 2027");
  });
});

describe("les regidories", () => {
  it("la taula surt de councilSeats i no d'una còpia", () => {
    const trams = tramsRegidories();
    expect(trams.map((t) => t.regidories)).toEqual([3, 5, 7, 9, 11, 13, 17, 21, 25]);
    for (const t of trams) {
      expect(councilSeats(t.des)).toBe(t.regidories);
      expect(councilSeats(t.fins!)).toBe(t.regidories);
    }
  });

  it("l'exemple de la llei d'Hondt és el que calcula dHondt()", () => {
    const { valids, barrera, files } = resolExempleDHondt();
    expect(valids).toBe(800);
    expect(barrera).toBe(40);
    const oficial = dHondt(EXEMPLE_DHONDT.candidatures, EXEMPLE_DHONDT.regidories, { validVotes: valids });
    expect(Object.fromEntries(files.map((f) => [f.id, f.regidories]))).toEqual(oficial.seats);
    expect(files.find((f) => f.id === "D")!.exclosa).toBe(true);
    // Tantes cel·les marcades com regidories.
    expect(files.flatMap((f) => f.quocients.filter((q) => q.guanya))).toHaveLength(EXEMPLE_DHONDT.regidories);
    expect(oficial.seats).toEqual({ A: 3, B: 3, C: 1, D: 0 });
  });

  it("la nota de l'exemple diu el que passa, sense xifres escrites a mà", () => {
    const { valids, files } = resolExempleDHondt();
    const nota = notaDHondt(files, valids);
    expect(nota).toContain("La D, amb el 4 %, no arriba al 5 %");
    expect(nota).toContain("l'última se l'endú la B perquè el seu quocient (86,7) passa per poc el següent de la A (85)");
    expect(nota).toContain("Cap no arriba a la majoria absoluta, que són 4 de 7");
  });
});

describe("preguntesMunicipals", () => {
  it("sis preguntes, amb font, i les dates marcades com a previstes fins al decret", () => {
    const cal = calendariMunicipals();
    const sense = preguntesMunicipals(cal, false);
    expect(sense).toHaveLength(6);
    for (const p of sense) expect(p.font?.nom).toBeTruthy();
    expect(sense.find((p) => p.pregunta.includes("correu"))!.quan).toBe("dates previstes segons la LOREG");
    expect(preguntesMunicipals(cal, true).every((p) => p.quan === null)).toBe(true);
  });
});

describe("renderMunicipals", () => {
  const html = renderMunicipals("2026-10-27T10:00:00Z");

  it("és la pàgina dels municipals: capçalera marcada, canònica i FAQPage", () => {
    expect(html).toContain('<span class="ara" aria-current="page">Com es vota</span>');
    expect(html).toContain('<link rel="canonical" href="https://quivoto.cat/observatori/municipals/">');
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain("Quan són les properes eleccions municipals a Catalunya?");
    expect(html).toContain("<h1>Com funcionen les municipals del 2027</h1>");
  });

  it("avisa que les dates són previstes fins que hi ha decret", () => {
    expect(html).toContain("Data prevista segons la LOREG.");
    expect(html).toContain("el 30 de març del 2027");
    const amb = renderMunicipals("2027-04-01", { decret: { nom: "Reial decret 999/2027", url: "https://www.boe.es/x" } });
    expect(amb).not.toContain("Data prevista segons la LOREG.");
    expect(amb).toContain("Dates fixades pel");
  });

  it("marca com a passades les fites d'abans del dia de publicació", () => {
    const despres = renderMunicipals("2027-04-20");
    expect(despres).toMatch(/id="fita-candidatures" class="mun-passada"/);
    expect(despres).not.toMatch(/id="fita-eleccions" class="mun-passada"/);
    expect(html).not.toContain("ja ha passat");
  });

  it("cita les fonts i enllaça els municipis en consell obert", () => {
    expect(html).toContain("BOE-A-1985-11672");
    expect(html).toContain("BOE-A-2023-8458");
    const amb = renderMunicipals("2026-10-27", { consellObert: [{ nom: "Gisclareny", slug: "gisclareny" }] });
    expect(amb).toContain('<a href="../m/gisclareny/">Gisclareny</a>');
  });

  it("no defineix cap classe nua al seu full: cada selector porta una classe mun-", () => {
    // El selector és el tros d'abans de l'última «{» de cada regla (dins d'un @media n'hi ha dues).
    const selectors = MUNICIPALS_CSS.replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .filter((r) => r.includes("{"))
      .map((r) => r.split("{").at(-2)!.trim())
      .flatMap((s) => s.split(","));
    expect(selectors.length).toBeGreaterThan(10);
    for (const sel of selectors) expect(sel, sel).toContain(".mun-");
  });

  it("no diu a qui votar ni jutja cap regla", () => {
    // El text que es llegeix: sense els fulls ni els guions, que porten comentaris d'altres mòduls.
    const text = html
      .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .toLowerCase();
    expect(text).not.toMatch(/\b(vota|voteu|votar) (a la|al|als|per la|pel) (llista|candidatura|partit)/);
    expect(text).not.toMatch(/\brecomanem\b/);
    expect(text).not.toMatch(/\bpitjor\b|\binjust/);
  });
});
