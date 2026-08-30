import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FONTS, parseTerrassa, type CarrecCiutat } from "../adapters/fotos-ciutats";
import {
  bytesDeFoto,
  ciutatDemanada,
  ciutatsDemanades,
  clauDeFoto,
  copiaDesadaDe,
  fitxaDeCiutat,
  idDeUrl,
  normalitzaCiutat,
} from "./j13-fotos-ciutats";

describe("QUIVOTO_CIUTATS", () => {
  it("sense la variable es fan totes les ciutats", () => {
    expect(ciutatsDemanades(undefined)).toBeNull();
    expect(ciutatsDemanades("")).toBeNull();
    expect(ciutatDemanada(null, ["Terrassa"])).toBe(true);
  });

  it("accepta noms amb accents, majúscules i apòstrofs, separats per comes", () => {
    const demanades = ciutatsDemanades("Terrassa, l'Hospitalet de Llobregat,MATARÓ");
    expect(demanades).toEqual(new Set(["terrassa", "l-hospitalet-de-llobregat", "mataro"]));
    expect(ciutatDemanada(demanades, ["Terrassa"])).toBe(true);
    expect(ciutatDemanada(demanades, ["Mataró"])).toBe(true);
    expect(ciutatDemanada(demanades, ["Barcelona"])).toBe(false);
  });

  it("també casa amb el slug de la base de dades, que no sempre és el nom", () => {
    // A la base, l'Hospitalet és «hospitalet-de-llobregat», sense l'article.
    const demanades = ciutatsDemanades("hospitalet-de-llobregat");
    expect(ciutatDemanada(demanades, ["l'Hospitalet de Llobregat", "hospitalet-de-llobregat"])).toBe(true);
    expect(normalitzaCiutat("l'Hospitalet de Llobregat")).toBe("l-hospitalet-de-llobregat");
  });
});

describe("copiaDesadaDe", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "quivoto-copies-"));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("torna null si la carpeta no hi és o no té cap HTML", async () => {
    expect(await copiaDesadaDe(join(dir, "no-existeix"))).toBeNull();
    await writeFile(join(dir, "notes.txt"), "res");
    expect(await copiaDesadaDe(dir)).toBeNull();
  });

  it("tria el HTML més recent i en dona el file:// perquè les imatges es trobin al costat", async () => {
    const vell = join(dir, "Consistori - vell.html");
    const nou = join(dir, "Consistori - Ajuntament de Terrassa.html");
    await writeFile(vell, "<p>vell</p>");
    await writeFile(nou, "<p>nou</p>");
    await utimes(vell, new Date("2026-01-01"), new Date("2026-01-01"));
    await utimes(nou, new Date("2026-08-30T10:00:00Z"), new Date("2026-08-30T10:00:00Z"));

    const copia = await copiaDesadaDe(dir);
    expect(copia?.html).toBe("<p>nou</p>");
    expect(copia?.base.startsWith("file://")).toBe(true);
    expect(decodeURIComponent(copia!.base)).toContain("Consistori - Ajuntament de Terrassa.html");
    expect(copia?.desat).toBe("2026-08-30");
  });

  it("llegeix una foto del disc quan la URL és file://", async () => {
    const cami = join(dir, "retrat.jpg");
    await writeFile(cami, Buffer.from([0xff, 0xd8, 0xff]));
    const copia = await copiaDesadaDe(dir);
    const url = new URL("./retrat.jpg", copia!.base).href;
    expect(await bytesDeFoto(url)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(await bytesDeFoto(new URL("./no-hi-es.jpg", copia!.base).href)).toBeNull();
  });
});

describe("identificador de la foto", () => {
  it("és el mateix llegit de la web i de la còpia desada", () => {
    const web: CarrecCiutat = {
      nom: "Jordi Ballart i Pastor",
      carrec: "Alcalde",
      grup: null,
      foto: "https://www.terrassa.cat/documents/12006/62063442/Jordi+Ballart+Pastor+TXT.jpg/5efeb063-171a-49b7-ad0a-a0affc19ab11?t=1687246991283",
      fotoClau: "terrassa/5efeb063-171a-49b7-ad0a-a0affc19ab11",
      fitxa: null,
    };
    const copia: CarrecCiutat = {
      ...web,
      foto: "file:///Users/algu/copies/terrassa/Consistori_files/5efeb063-171a-49b7-ad0a-a0affc19ab11.jpg",
    };
    expect(clauDeFoto(web)).toBe(clauDeFoto(copia));
    expect(idDeUrl(clauDeFoto(web)!)).toBe(idDeUrl(clauDeFoto(copia)!));
  });

  it("sense clau declarada, la URL mana, com fins ara", () => {
    const c: CarrecCiutat = { nom: "X", carrec: "", grup: null, foto: "https://a/b.jpg", fitxa: null };
    expect(clauDeFoto(c)).toBe("https://a/b.jpg");
    expect(clauDeFoto({ ...c, foto: null })).toBeNull();
  });
});

describe("fitxaDeCiutat", () => {
  const fixture = new URL("../adapters/__fixtures__/terrassa-consistori.html", import.meta.url);

  it("marca l'equip de govern quan la font ho diu, i no el marca quan no", async () => {
    const { readFile } = await import("node:fs/promises");
    const carrecs = parseTerrassa(await readFile(fixture, "utf8"));
    const ids = new Set(carrecs.map((c) => idDeUrl(clauDeFoto(c)!)));
    const fitxa = fitxaDeCiutat(FONTS.Terrassa!, carrecs, ids, "2026-08-30") as {
      carrecs: { nom: string; equipGovern: boolean; foto: string | null; fotoId: number }[];
      cobertura: string;
      ambFoto: number;
      url: string;
    };
    expect(fitxa.carrecs.find((c) => c.nom === "Jordi Ballart i Pastor")?.equipGovern).toBe(true);
    expect(fitxa.carrecs.find((c) => c.nom === "Marc Armengol Puig")?.equipGovern).toBe(false);
    expect(fitxa.cobertura).toBe("completa");
    expect(fitxa.url).toBe("https://www.terrassa.cat/protecciodades");

    // Barcelona no diu qui governa: cap marca.
    const sense = fitxaDeCiutat(FONTS.Barcelona!, [{ ...carrecs[0]!, equipGovern: undefined }], ids, "2026-08-30") as {
      carrecs: { equipGovern: boolean }[];
    };
    expect(sense.carrecs[0]!.equipGovern).toBe(false);
  });

  it("l'id de la foto surt de la clau estable, no del file://", async () => {
    const { readFile } = await import("node:fs/promises");
    const html = await readFile(fixture, "utf8");
    const web = parseTerrassa(html);
    const desada = parseTerrassa(html, "file:///tmp/copies/terrassa/Consistori.html");
    const idsWeb = (fitxaDeCiutat(FONTS.Terrassa!, web, new Set(), "x") as { carrecs: { fotoId: number }[] }).carrecs;
    const idsDesada = (fitxaDeCiutat(FONTS.Terrassa!, desada, new Set(), "x") as { carrecs: { fotoId: number }[] }).carrecs;
    expect(idsDesada.map((c) => c.fotoId)).toEqual(idsWeb.map((c) => c.fotoId));
  });
});
