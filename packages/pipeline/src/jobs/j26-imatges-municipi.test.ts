import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ampladaDesti,
  camiCredit,
  camiPublicImatge,
  creditDesat,
  directoriImatges,
  fitxaImatges,
  nomDeCommons,
  semblaSvg,
  serveixElQueHiHa,
  urlDescarrega,
  veredicteSvg,
  type ImatgeDesada,
} from "./j26-imatges-municipi";
import type { ImatgeCommons } from "./j20-wikidata";

/**
 * L'escut i la fotografia d'Abrera, tal com J20 els va desar. Les xifres que
 * surten als comentaris d'aquest fitxer estan mesurades contra Commons el
 * 30-08-2026: l'SVG fa 32.966 bytes, l'original de la fotografia 6.702.968 i
 * la còpia de 1.024 px, 358.832.
 */
const ESCUT: ImatgeCommons = {
  fitxer: "File:Escudo de Abrera (Barcelona).svg",
  url: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Escudo_de_Abrera_%28Barcelona%29.svg",
  pagina: "https://commons.wikimedia.org/wiki/File:Escudo_de_Abrera_(Barcelona).svg",
  llicencia: "cc-by-sa-4.0",
  llicenciaNom: "CC BY-SA 4.0",
  autor: null,
};

describe("camins", () => {
  /** El codi INE és la clau estable: els noms canvien, els QID es fusionen. */
  it("anomena els fitxers amb el codi INE", () => {
    expect(camiPublicImatge("escut", "08001", "svg")).toBe("/observatori/escuts/08001.svg");
    expect(camiPublicImatge("vista", "08001", "webp")).toBe("/observatori/vistes/08001.webp");
  });

  it("desa cada mena al seu directori dins de la sortida de l'Observatori", () => {
    expect(directoriImatges("escut", "/repo")).toBe("/repo/web/public/observatori/escuts");
    expect(directoriImatges("vista", "/repo")).toBe("/repo/web/public/observatori/vistes");
  });

  it("posa el crèdit al costat de la imatge i amb el mateix nom", () => {
    expect(camiCredit("escut", "08001", "/repo")).toBe("/repo/web/public/observatori/escuts/08001.json");
  });
});

describe("urlDescarrega", () => {
  /**
   * Sense amplada, l'original: és el que volem de l'SVG, verbatim. Amb
   * amplada, la còpia que Commons ja té feta, que per a la fotografia d'Abrera
   * són 359 kB en comptes de 6,7 MB.
   */
  it("demana l'original o la còpia reduïda segons calgui", () => {
    expect(urlDescarrega(ESCUT.fitxer)).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/Escudo%20de%20Abrera%20(Barcelona).svg",
    );
    expect(urlDescarrega("File:Abrera-57.jpg", 1024)).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/Abrera-57.jpg?width=1024",
    );
  });

  it("treu el prefix de Commons del títol", () => {
    expect(nomDeCommons("File:Abrera-57.jpg")).toBe("Abrera-57.jpg");
    expect(nomDeCommons("Fitxer: Escut.svg")).toBe("Escut.svg");
  });
});

describe("semblaSvg", () => {
  /** El contingut mana sobre el nom: a Commons hi ha fitxers reanomenats. */
  it("mira els bytes i no l'extensió", () => {
    expect(semblaSvg('<?xml version="1.0"?><svg viewBox="0 0 10 10"></svg>')).toBe(true);
    expect(semblaSvg('<svg xmlns="http://www.w3.org/2000/svg"/>')).toBe(true);
    expect(semblaSvg("ÿØÿà JFIF")).toBe(false);
  });
});

describe("veredicteSvg", () => {
  it("publica verbatim un escut normal", () => {
    expect(veredicteSvg('<svg viewBox="0 0 500 600"><path d="m0 0"/></svg>', 32_966).publicable).toBe(true);
  });

  /**
   * El fitxer es publica al nostre domini: qui obri l'SVG en una pestanya el fa
   * córrer amb el nostre origen. Un escut amb codi executable no el volem, i
   * com que d'ell només ens interessa el dibuix, es rasteritza.
   */
  it("rebutja el que porta codi executable", () => {
    expect(veredicteSvg("<svg><script>alert(1)</script></svg>", 500).publicable).toBe(false);
    expect(veredicteSvg('<svg onload="alert(1)"></svg>', 500).publicable).toBe(false);
    expect(veredicteSvg("<svg><foreignObject/></svg>", 500).publicable).toBe(false);
  });

  /** Per sobre del límit el vector ja no és l'opció lleugera. */
  it("rebutja els desmesurats", () => {
    expect(veredicteSvg("<svg/>", 400_000).publicable).toBe(false);
    expect(veredicteSvg("<svg/>", 400_000, 500_000).publicable).toBe(true);
  });
});

describe("ampladaDesti", () => {
  /** No inventar-se píxels: la mateixa regla que J11, sense retallar res. */
  it("no escala mai cap amunt", () => {
    expect(ampladaDesti(1024, { amplada: 1280, alcada: 853 })).toBe(1024);
    expect(ampladaDesti(1024, { amplada: 800, alcada: 600 })).toBe(800);
  });

  /**
   * L'alçada no hi entra: si hi entrés, una panoràmica de 1.280×400 es desaria
   * a 400 px d'ample. J11 sí que la mira perquè allà la miniatura és quadrada.
   */
  it("no mira l'alçada", () => {
    expect(ampladaDesti(1024, { amplada: 1280, alcada: 300 })).toBe(1024);
  });
});

describe("idempotència", () => {
  /**
   * Comparar el camí local no bastaria: el nom és el codi INE i no canvia mai,
   * de manera que un escut substituït a Wikidata no es baixaria mai més.
   */
  it("només serveix el que ja hi ha si ve del mateix fitxer de Commons", () => {
    const previ: ImatgeDesada = {
      mena: "escut", cami: "/observatori/escuts/08001.svg", format: "svg",
      amplada: null, alcada: null, derivada: false,
      fitxer: ESCUT.fitxer, pagina: ESCUT.pagina, llicencia: ESCUT.llicencia,
      llicenciaNom: ESCUT.llicenciaNom, autor: null,
      font: "Wikimedia Commons (commons.wikimedia.org)", descarregat: "2026-08-30",
    };
    expect(serveixElQueHiHa(previ, ESCUT)).toBe(true);
    expect(serveixElQueHiHa(previ, { ...ESCUT, fitxer: "File:Escut d'Abrera nou.svg" })).toBe(false);
    expect(serveixElQueHiHa(null, ESCUT)).toBe(false);
  });

  it("un crèdit trencat es tracta com si no hi fos", async () => {
    const arrel = await mkdtemp(join(tmpdir(), "quivoto-j26-"));
    await mkdir(directoriImatges("escut", arrel), { recursive: true });
    await writeFile(camiCredit("escut", "08001", arrel), "{ no és json", "utf8");
    expect(await creditDesat("escut", "08001", arrel)).toBeNull();
  });

  it("llegeix el crèdit desat al costat de la imatge", async () => {
    const arrel = await mkdtemp(join(tmpdir(), "quivoto-j26-"));
    await mkdir(directoriImatges("vista", arrel), { recursive: true });
    const desat = { mena: "vista", cami: "/observatori/vistes/08001.webp", fitxer: "File:Abrera-57.jpg" };
    await writeFile(camiCredit("vista", "08001", arrel), JSON.stringify(desat), "utf8");
    const llegit = await creditDesat("vista", "08001", arrel);
    expect(llegit?.fitxer).toBe("File:Abrera-57.jpg");
    // I el que hi ha escrit és exactament el que es va desar: si el fitxer
    // d'imatges se separa de la base, l'atribució hi viatja igualment.
    expect(JSON.parse(await readFile(camiCredit("vista", "08001", arrel), "utf8")).cami).toBe(
      "/observatori/vistes/08001.webp",
    );
  });
});

describe("fitxaImatges", () => {
  it("desa la font i la data encara que hi falti una de les dues imatges", () => {
    const fitxa = fitxaImatges("08001", null, null, "2026-08-30");
    expect(fitxa.font).toContain("commons.wikimedia.org");
    expect(fitxa.descarregat).toBe("2026-08-30");
    expect(fitxa.escut).toBeNull();
  });
});
