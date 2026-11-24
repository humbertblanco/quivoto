import { inflateRawSync } from "node:zlib";

/**
 * Llegeix els fitxers d'un ZIP sense cap dependència: el directori central,
 * i cada entrada desada (mètode 0) o comprimida amb deflate (mètode 8), que
 * són els dos únics que fa servir l'ICGC.
 *
 * Existeix per no afegir una llibreria al pipeline per llegir un sol fitxer:
 * el de les seccions censals (J47). No sap llegir ZIP64 ni xifrats, i ho diu.
 */
export function llegeixZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // El registre del final del directori central: com a molt a 64 kB del final.
  let fi = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      fi = i;
      break;
    }
  }
  if (fi < 0) throw new Error("zip: no trobo el directori central");
  const entrades = buf.readUInt16LE(fi + 10);
  let p = buf.readUInt32LE(fi + 16);
  if (p === 0xffffffff) throw new Error("zip: ZIP64 no suportat");

  const fitxers = new Map<string, Uint8Array>();
  for (let n = 0; n < entrades; n += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("zip: entrada del directori central malmesa");
    const metode = buf.readUInt16LE(p + 10);
    const comprimit = buf.readUInt32LE(p + 20);
    const llargNom = buf.readUInt16LE(p + 28);
    const llargExtra = buf.readUInt16LE(p + 30);
    const llargComentari = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nom = buf.toString("utf8", p + 46, p + 46 + llargNom);
    p += 46 + llargNom + llargExtra + llargComentari;
    if (nom.endsWith("/")) continue;

    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error(`zip: capçalera local malmesa a ${nom}`);
    const inici = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const dades = buf.subarray(inici, inici + comprimit);
    if (metode === 0) fitxers.set(nom, new Uint8Array(dades));
    else if (metode === 8) fitxers.set(nom, new Uint8Array(inflateRawSync(dades)));
    else throw new Error(`zip: mètode ${metode} no suportat a ${nom}`);
  }
  return fitxers;
}
