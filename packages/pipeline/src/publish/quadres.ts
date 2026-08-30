/**
 * El repartiment d'un total, en quadres.
 *
 * Sis regles paral·leles diuen quant val cada partida i no diuen quina part és
 * cadascuna: l'IBI és el 57 % de tot el que recapta Barcelona i, com a barra
 * al costat de les altres cinc, sembla només «la més llarga». Amb els quadres
 * la proporció és l'àrea i es llegeix sense comptar res.
 *
 * L'algorisme és el «squarified treemap» de Bruls, Huizing i van Wijk: reparteix
 * els trossos en files procurant que quedin com més quadrats millor, perquè un
 * requadre llarg i prim no es compara bé amb un altre. No hi ha cap llibreria:
 * són trenta línies i el que en surt és HTML amb percentatges, de manera que el
 * dibuix s'adapta a l'amplada sense JavaScript.
 *
 * **No serveix per comparar dos totals.** El que entra i el que surt d'un
 * ajuntament no són la mateixa magnitud —la diferència són les transferències
 * d'altres administracions— i posar-los al mateix quadrat diria que se'n gasta
 * el triple del que s'ingressa. Van en dos dibuixos, cadascun amb el seu total
 * escrit a sobre.
 */

export type Tros = { etiqueta: string; valor: number };
export type Caixa = Tros & { x: number; y: number; w: number; h: number; part: number };

/** La pitjor relació d'aspecte d'una fila, que és el que l'algorisme minimitza. */
function pitjor(fila: readonly number[], costat: number, escala: number): number {
  const suma = fila.reduce((a, v) => a + v, 0) * escala;
  if (suma <= 0 || costat <= 0) return Number.POSITIVE_INFINITY;
  const max = Math.max(...fila) * escala;
  const min = Math.min(...fila) * escala;
  return Math.max((costat * costat * max) / (suma * suma), (suma * suma) / (costat * costat * min));
}

/**
 * Reparteix els trossos dins d'un rectangle. Les mesures són relatives (0..100)
 * perquè el resultat s'escrigui en percentatges i el dibuix sigui elàstic.
 */
export function quadres(trossos: readonly Tros[], total?: number): Caixa[] {
  const nets = trossos.filter((t) => t.valor > 0).sort((a, b) => b.valor - a.valor);
  if (nets.length === 0) return [];
  const suma = total && total > 0 ? total : nets.reduce((a, t) => a + t.valor, 0);
  const fora: Caixa[] = [];

  const reparteix = (queden: Tros[], x: number, y: number, w: number, h: number): void => {
    if (queden.length === 0 || w <= 0 || h <= 0) return;
    const resta = queden.reduce((a, t) => a + t.valor, 0);
    if (resta <= 0) return;
    const escala = (w * h) / resta;

    let fila: Tros[] = [];
    let pendents = queden;
    while (pendents.length > 0) {
      const costat = Math.min(w, h);
      const prova = [...fila, pendents[0]!];
      const abans = fila.length === 0 ? Number.POSITIVE_INFINITY : pitjor(fila.map((t) => t.valor), costat, escala);
      if (pitjor(prova.map((t) => t.valor), costat, escala) > abans) break;
      fila = prova;
      pendents = pendents.slice(1);
    }

    const areaFila = fila.reduce((a, t) => a + t.valor, 0) * escala;
    if (w >= h) {
      const fw = areaFila / h;
      let oy = y;
      for (const t of fila) {
        const fh = (t.valor * escala) / fw;
        fora.push({ ...t, x, y: oy, w: fw, h: fh, part: (100 * t.valor) / suma });
        oy += fh;
      }
      reparteix(pendents, x + fw, y, w - fw, h);
    } else {
      const fh = areaFila / w;
      let ox = x;
      for (const t of fila) {
        const fw = (t.valor * escala) / fh;
        fora.push({ ...t, x: ox, y, w: fw, h: fh, part: (100 * t.valor) / suma });
        ox += fw;
      }
      reparteix(pendents, x, y + fh, w, h - fh);
    }
  };

  reparteix([...nets], 0, 0, 100, 100);
  return fora;
}
