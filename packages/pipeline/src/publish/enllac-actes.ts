/**
 * Lliga una afirmació amb el punt de l'acta que cita.
 *
 * Les evidències estan escrites per una persona i comencen sempre igual: «Ple de
 * 18 d'octubre de 2023, acord núm. 6», «Ple del 27/10/2025». Les actes ingerides
 * per J12 porten la data i el número de cada punt. Amb això n'hi ha prou per
 * trobar el punt exacte i llegir-ne el vot de cada grup **tal com surt a
 * l'acta**, sense haver de deduir res dels números.
 *
 * És la font bona. Les regles de `posicions.ts` són el que es pot fer quan
 * l'acta no s'ha pogut llegir; això és el que es pot fer quan sí.
 */

export type PuntActa = {
  data: string;
  numero: string | null;
  titol: string;
  url: string;
  unanimitat: boolean;
  vots: { grup: string; sentit: string; vots: number | null }[];
};

const MESOS: Record<string, number> = {
  gener: 1, febrer: 2, marc: 3, abril: 4, maig: 5, juny: 6,
  juliol: 7, agost: 8, setembre: 9, octubre: 10, novembre: 11, desembre: 12,
};

const senseAccents = (t: string): string =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * La data del ple que cita una evidència, en ISO.
 *
 * Només mira el començament del text: una evidència pot citar dos plens («Ple
 * del 27/10/2025… El 18/10/2024 el tipus ja havia passat…») i el que compta és
 * el primer, que és el que sosté l'afirmació.
 */
export function dataCitada(evidencia: string): string | null {
  const cap = evidencia.slice(0, 160);
  const numerica = cap.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (numerica) {
    return `${numerica[3]}-${numerica[2]!.padStart(2, "0")}-${numerica[1]!.padStart(2, "0")}`;
  }
  // «18 d'octubre de 2023», «11 de desembre de 2025», «1r de juny de 2024».
  const literal = senseAccents(cap).match(
    /\b(\d{1,2})\s*(?:r|n|er|a)?\s+d[e']?\s*([a-z]+)\s+de\s+(\d{4})\b/,
  );
  if (!literal) return null;
  const mes = MESOS[literal[2]!];
  if (mes === undefined) return null;
  return `${literal[3]}-${String(mes).padStart(2, "0")}-${literal[1]!.padStart(2, "0")}`;
}

/** El número d'acord que cita una evidència: «acord núm. 6» → «6». */
export function acordCitat(evidencia: string): string | null {
  const m = evidencia.slice(0, 200).match(/acord\s+n(?:úm|um)\.?\s*(\d{1,3})/i);
  return m ? m[1]! : null;
}

/**
 * El punt d'acta que sosté una afirmació, o `null`.
 *
 * Amb data i número d'acord la coincidència és exacta. Amb data sola només val
 * si aquell ple té un únic punt amb vot desglossat per grup: si n'hi ha dos, no
 * hi ha manera de saber quin és i agafar-ne un a l'atzar seria atribuir a un
 * partit el vot d'una altra cosa.
 */
export function puntDe(evidencia: string, punts: readonly PuntActa[]): PuntActa | null {
  const data = dataCitada(evidencia);
  if (data === null) return null;
  const delDia = punts.filter((p) => p.data === data);
  if (delDia.length === 0) return null;

  const acord = acordCitat(evidencia);
  if (acord !== null) {
    const exactes = delDia.filter((p) => p.numero !== null && netejaNumero(p.numero) === acord);
    return exactes.length === 1 ? exactes[0]! : null;
  }
  const ambVot = delDia.filter((p) => p.vots.length > 0 || p.unanimitat);
  return ambVot.length === 1 ? ambVot[0]! : null;
}

/** «6.», «06», «núm. 6» → «6». */
function netejaNumero(numero: string): string {
  const m = numero.match(/(\d{1,3})/);
  return m ? String(Number.parseInt(m[1]!, 10)) : numero;
}
