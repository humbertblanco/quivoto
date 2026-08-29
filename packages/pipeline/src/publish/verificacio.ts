import type { Conjunt } from "./llindar";

/**
 * Quina part d'un conjunt d'afirmacions se sosté en una acta del ple.
 *
 * Va sortir d'una auditoria: de les 175 afirmacions escrites, 115 tenien algun
 * problema, i els conjunts pitjors compartien un tret que es pot mesurar sense
 * llegir-ne cap. **Terrassa no citava ni una sola acta**: vint de vint-i-cinc
 * evidències eren notes de premsa i dues enllaçaven el nostre propi web. Amb
 * premsa es pot escriure el que sigui i sona bé; amb una acta, no.
 *
 * Per això la demostració que es pot respondre només es genera per als conjunts
 * que s'aguanten en actes. No és una mesura de qualitat —una acta mal citada
 * segueix sent una cita dolenta—, és el mínim per sota del qual no val la pena
 * ni mirar-s'ho.
 *
 * L'acteca de l'AOC (`media.seu-e.cat/acteca`) és on els ajuntaments dipositen
 * les actes; `dadesobertes.seu-e.cat` i `cido.diba.cat` són catàlegs, i un
 * catàleg no és un acord.
 */

/** Les afirmacions que citen una acta de ple de veritat. */
export function ambActa(conjunt: Conjunt): number {
  return conjunt.afirmacions.filter((a) => esActa(a.url_evidencia)).length;
}

/**
 * L'adreça és el registre oficial d'una votació del ple?
 *
 * La regla no és «que sigui un PDF de l'acteca»: és **que sigui el registre que
 * publica la institució que va prendre la decisió**. L'acteca de l'AOC ho és
 * per als 900 ajuntaments que hi dipositen, i és la via normal. Però Barcelona
 * no hi diposita res útil —el que hi puja són extractes sense el sentit del
 * vot— i en canvi publica el **registre complet de votacions del plenari**, amb
 * el vot de cada grup, 814 propostes del mandat. Aquell registre no és pitjor
 * que una acta: és millor, perquè ja ve desglossat.
 *
 * El que la regla continua deixant fora, i és tot el sentit que té, és la
 * **premsa** i el nostre propi web. Un conjunt es va escriure amb vint notes de
 * diari i dos enllaços a quivoto.cat per acreditar una xifra nostra, i amb
 * premsa es pot escriure el que sigui i sona bé.
 *
 * Cada excepció que s'hi afegeixi ha de ser un registre oficial de votacions
 * publicat per l'ajuntament mateix, i s'ha d'escriure aquí amb el motiu.
 */
export function esActa(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    // L'acteca del Consorci AOC, on diposita la immensa majoria d'ajuntaments.
    if (u.hostname === "media.seu-e.cat" && u.pathname.startsWith("/acteca")) return true;
    // El registre de votacions del plenari de Barcelona, publicat per
    // l'Ajuntament amb el vot de cada grup.
    if (u.hostname === "ajuntament.barcelona.cat") {
      return (
        u.pathname.includes("/votacions_plenari/") ||
        u.pathname.includes("/acords-del-plenari") ||
        /CPlenari.*\.pdf$/i.test(u.pathname)
      );
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * El llindar per generar-ne la demostració jugable.
 *
 * Tres quartes parts sostingudes en acta. Amb menys, el que s'ensenyaria no
 * seria «què ha votat cadascú» sinó «què n'ha dit el diari», que és una altra
 * cosa i no és la nostra.
 */
export const MINIM_ACTES = 0.75;

export type EstatVerificacio = {
  total: number;
  ambActa: number;
  proporcio: number;
  /** Si es pot generar la demostració que es respon. */
  jugable: boolean;
  motiu: string | null;
};

export function verifica(conjunt: Conjunt): EstatVerificacio {
  const total = conjunt.afirmacions.length;
  const actes = ambActa(conjunt);
  const proporcio = total === 0 ? 0 : actes / total;
  const jugable = total > 0 && proporcio >= MINIM_ACTES;
  return {
    total,
    ambActa: actes,
    proporcio,
    jugable,
    motiu: jugable
      ? null
      : actes === 0
        ? "cap de les afirmacions no cita una acta del ple"
        : `només ${actes} de ${total} afirmacions citen una acta del ple`,
  };
}
