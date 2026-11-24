/**
 * Un lector de shapefile de polígons, prou per a les seccions censals de
 * l'ICGC (J47) i res més: `.shp` de tipus polígon (5, i els seus germans amb Z
 * o M, dels quals només es llegeix el pla) i `.dbf` amb camps de text i
 * numèrics.
 *
 * Les coordenades surten tal com les porta el fitxer. L'ICGC les dona en
 * ETRS89 / UTM 31N, en metres, i per dibuixar el mapa d'un municipi és just el
 * que cal: una projecció plana on un metre és un metre en totes direccions.
 */

export type Anell = [number, number][];
export type Forma = { anells: Anell[] };
export type Registre = Record<string, string>;

const TIPUS_POLIGON = new Set([5, 15, 25]);

export function llegeixShp(bytes: Uint8Array): (Forma | null)[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getInt32(0, false) !== 9994) throw new Error("shp: no és un shapefile");
  const formes: (Forma | null)[] = [];
  let p = 100;
  while (p + 8 <= bytes.byteLength) {
    const llarg = v.getInt32(p + 4, false) * 2;
    const c = p + 8;
    const tipus = v.getInt32(c, true);
    if (tipus === 0) formes.push(null);
    else if (TIPUS_POLIGON.has(tipus)) {
      const nParts = v.getInt32(c + 36, true);
      const nPunts = v.getInt32(c + 40, true);
      const parts: number[] = [];
      for (let i = 0; i < nParts; i += 1) parts.push(v.getInt32(c + 44 + 4 * i, true));
      const base = c + 44 + 4 * nParts;
      const anells: Anell[] = [];
      for (let i = 0; i < nParts; i += 1) {
        const desde = parts[i]!;
        const fins = i + 1 < nParts ? parts[i + 1]! : nPunts;
        const anell: Anell = [];
        for (let k = desde; k < fins; k += 1) {
          anell.push([v.getFloat64(base + 16 * k, true), v.getFloat64(base + 16 * k + 8, true)]);
        }
        anells.push(anell);
      }
      formes.push({ anells });
    } else throw new Error(`shp: tipus de forma ${tipus} no suportat`);
    p = c + llarg;
  }
  return formes;
}

export function llegeixDbf(bytes: Uint8Array): Registre[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = v.getUint32(4, true);
  const llargCap = v.getUint16(8, true);
  const llargReg = v.getUint16(10, true);
  const camps: { nom: string; llarg: number }[] = [];
  const dec = new TextDecoder("utf-8");
  for (let p = 32; bytes[p] !== 0x0d && p < llargCap; p += 32) {
    const cru = bytes.subarray(p, p + 11);
    const fi = cru.indexOf(0);
    camps.push({ nom: dec.decode(fi >= 0 ? cru.subarray(0, fi) : cru), llarg: bytes[p + 16]! });
  }
  const registres: Registre[] = [];
  for (let r = 0; r < n; r += 1) {
    let p = llargCap + r * llargReg + 1; // el primer byte marca si està esborrat
    const reg: Registre = {};
    for (const camp of camps) {
      reg[camp.nom] = dec.decode(bytes.subarray(p, p + camp.llarg)).trim();
      p += camp.llarg;
    }
    registres.push(reg);
  }
  return registres;
}
