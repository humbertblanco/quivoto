import { siglesFamily } from "@quivoto/shared-schemas/brands";
import { normalize } from "../lib/text";

/**
 * La família de cada llista d'una mateixa elecció, sense que dues llistes
 * caiguin al mateix sac.
 *
 * `siglesFamily()` diu de quina força és una candidatura mirant-ne les
 * sigles, i és el que permet comparar dotze eleccions en què els noms canvien
 * cada quatre anys. Però una família és un partit, i un partit no presenta
 * dues llistes a la mateixa elecció: si dues candidatures del mateix any
 * cauen a la mateixa família, una de les dues hi ha caigut per un tros del
 * nom. A Badalona el 2015, «Guanyem Badalona en Comú» (5 regidories) i
 * «ICV-EUiA-E» (2) sortien juntes com a «Comuns / ICV: 7», quan van anar per
 * separat i eren espais diferents. Aquí, davant d'un doblet, es queda a la
 * família la llista que la porta al davant de tot (el primer tros de les
 * sigles ja la diu: «ICV»), i si cap o totes dues, la que té més regidories;
 * l'altra passa a «local», que és el que és: una llista d'aquell poble.
 */
export function familiaDeCadaLlista(
  llistes: readonly { sigles: string; seats: number }[],
): string[] {
  const families = llistes.map((l) => siglesFamily(l.sigles) ?? "local");
  const perFamilia = new Map<string, number[]>();
  families.forEach((f, i) => {
    if (f === "local") return;
    perFamilia.set(f, [...(perFamilia.get(f) ?? []), i]);
  });
  for (const [familia, indexs] of perFamilia) {
    if (indexs.length < 2) continue;
    const primerTros = (sigles: string): string => normalize(sigles).split(/[^a-z0-9]+/).filter(Boolean)[0] ?? "";
    const propietaries = indexs.filter((i) => siglesFamily(primerTros(llistes[i]!.sigles)) === familia);
    const candidates = propietaries.length >= 1 ? propietaries : indexs;
    const titular = [...candidates].sort((a, b) => llistes[b]!.seats - llistes[a]!.seats)[0]!;
    for (const i of indexs) if (i !== titular) families[i] = "local";
  }
  return families;
}
