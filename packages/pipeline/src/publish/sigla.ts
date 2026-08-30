import { BRANDS_BY_ID, siglesFamily } from "@quivoto/shared-schemas/brands";
import { sobreColor } from "./contrast";

/**
 * Les sigles d'un partit, i el camí cap a la seva pàgina.
 *
 * La pastilla de sigles surt a tot arreu —al resum de cada fitxa, a la targeta
 * de l'alcaldia, al ple, a la taula de les dotze eleccions, a la llista dels
 * 947— i **cap no portava enlloc**: 947 a `els947.html` i 93 a una sola fitxa
 * municipal, totes mortes. Mentrestant el nom d'una persona sí que porta a la
 * seva pàgina des de fa temps, i des d'avui hi ha quinze pàgines de partit que
 * només es podien trobar pel cercador.
 *
 * Aquí es decideix una vegada i s'aplica a tot arreu, que és el que fa que el
 * lector no hagi d'aprendre on es pot clicar i on no.
 *
 * **Quan no sabem de quin partit és, no s'hi enllaça.** Les llistes locals no
 * tenen pàgina i no n'han de tenir: sota aquella etiqueta hi ha centenars de
 * candidatures que no tenen res a veure les unes amb les altres, i ajuntar-les
 * diria que existeix un partit que no existeix. La pastilla es queda igual de
 * pintada i simplement no és un enllaç.
 */

const escape = (t: string): string =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * L'identificador de la pàgina de partit d'unes sigles, o `null`.
 *
 * `local` no compta: és el calaix de les que no hem sabut reconèixer, no una
 * marca, i no té pàgina.
 */
export function partitDe(sigles: string | null | undefined, brandId?: string | null): string | null {
  const desat = brandId && brandId !== "local" ? brandId : null;
  const id = desat ?? (sigles ? siglesFamily(sigles) : null);
  return id && id !== "local" && BRANDS_BY_ID.has(id) ? id : null;
}

export type OpcionsSigla = {
  /** Camí fins a `/observatori/`, amb la barra final. Sense això no hi ha enllaç. */
  base?: string | null;
  /** El `brandId` desat a la ingesta, quan el tenim: mana sobre les sigles. */
  brandId?: string | null;
  /** El color de la font per a aquesta candidatura, si en porta cap. */
  color?: string | null;
  /** Classes de més, per a qui la vulgui més gran o dins d'una fila. */
  classe?: string;
};

/**
 * La pastilla, enllaçada quan es pot.
 *
 * El color el decideix `sobreColor()`, que tria la tinta que s'hi llegeix: unes
 * sigles grogues amb lletra blanca no es veuen, i el groc de la CUP i el
 * turquesa de Junts són casos reals d'això.
 */
export function sigla(sigles: string, opcions: OpcionsSigla = {}): string {
  const id = partitDe(sigles, opcions.brandId);
  const marca = id ? BRANDS_BY_ID.get(id) : null;
  /*
   * Mana la marca, i el color de la font només quan no la sabem.
   *
   * A l'inrevés passava el que ja va passar a la taula de les eleccions: la
   * pastilla del PSC a la fitxa d'un regidor sortia grisa perquè aquella pàgina
   * arrossegava un color de reserva, i el gris és el que ha de voler dir «no
   * sabem de qui és». Quan el partit el sabem, no hi ha res a decidir.
   */
  const oficial = opcions.color?.trim();
  const color =
    marca?.color ?? (oficial && /^#[0-9a-f]{6}$/i.test(oficial) ? oficial : "#8b8b8b");
  const { fons, tinta } = sobreColor(color);
  const classe = ["sigla", opcions.classe].filter(Boolean).join(" ");
  const estil = `--c:${fons};--t:${tinta}`;
  if (!id || !opcions.base) {
    return `<b class="${classe}" style="${estil}">${escape(sigles)}</b>`;
  }
  return `<a class="${classe}" style="${estil}" href="${escape(opcions.base)}partit/${escape(id)}/"
    title="${escape(marca?.name ?? sigles)} a tot Catalunya">${escape(sigles)}</a>`;
}
