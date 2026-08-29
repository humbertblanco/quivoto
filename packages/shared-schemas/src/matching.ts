import { type Value, isValue } from "./types";

/**
 * Coincidència entre les respostes de l'usuari i les posicions d'un subjecte
 * (candidatura o persona). Fórmula compatible amb el Valkompass de la SVT:
 * distància de Manhattan sobre l'escala −2..2, amb pesos per importància.
 *
 * El càlcul viu al navegador i treballa sobre el paquet publicat del municipi:
 * les respostes de l'usuari no surten mai del seu dispositiu.
 */

/** Com sabem la posició d'un subjecte sobre una afirmació. */
export type PositionKind =
  /** Tenim posició, declarada o inferida amb prou confiança. */
  | "answered"
  /** No tenim prou evidència. L'afirmació surt del denominador d'aquest subjecte. */
  | "no_data"
  /** El subjecte declara explícitament que no s'hi posiciona. Es penalitza. */
  | "no_position";

export type SubjectPosition = {
  kind: PositionKind;
  /** Obligatori si `kind === "answered"`. */
  value?: Value | null;
  /** El subjecte ha marcat l'afirmació com a prioritària (màxim 5). */
  priority?: boolean;
};

export type Subject = {
  id: string;
  /** Per al desempat alfabètic final. */
  name: string;
  /** Clau = id de l'afirmació. Una clau absent equival a `no_data`. */
  positions: Record<string, SubjectPosition | undefined>;
};

export type UserAnswer = {
  /** `null` = l'usuari ha omès l'afirmació: surt del càlcul per a tothom. */
  value: Value | null;
  important?: boolean;
};

export type MatchOptions = {
  /**
   * Fracció mínima de les afirmacions respostes per a les quals cal tenir
   * posició per classificar el subjecte. Per sota, va a «Dades insuficients».
   */
  coverageThreshold?: number;
  /** Temes triats per l'usuari, per al segon desempat. */
  selectedThemes?: readonly string[];
  /** Tema de cada afirmació, per al segon desempat. */
  statementThemes?: Readonly<Record<string, string>>;
};

/** Etiqueta per fila a la comparació afirmació a afirmació. */
export type AgreementLabel = "same" | "close" | "different" | "opposed" | "unknown";

export type StatementBreakdown = {
  statementId: string;
  userValue: Value;
  userImportant: boolean;
  kind: PositionKind;
  subjectValue: Value | null;
  subjectPriority: boolean;
  /** Distància de Manhattan, 0–4. `null` si no hi ha posició. */
  distance: number | null;
  label: AgreementLabel;
  weight: number;
  /** Punts obtinguts, −1..4. */
  score: number | null;
};

export type SubjectMatch = {
  subjectId: string;
  name: string;
  /** 0–100. `null` quan el subjecte no es classifica. */
  matchPct: number | null;
  classified: boolean;
  /** Afirmacions amb posició, de les respostes per l'usuari. */
  known: number;
  answered: number;
  coverage: number;
  breakdown: StatementBreakdown[];
};

export const DEFAULT_COVERAGE_THRESHOLD = 0.7;

/** Punts quan el subjecte esquiva l'afirmació havent-hi pogut respondre. */
export const NO_POSITION_SCORE = -1;

const MAX_SCORE = 4;

function labelFor(distance: number | null): AgreementLabel {
  if (distance === null) return "unknown";
  if (distance === 0) return "same";
  if (distance === 1) return "close";
  if (distance === 2) return "different";
  return "opposed";
}

/**
 * Pes de l'afirmació: 1 de base, 2 si l'usuari la marca com a molt important,
 * i el doble si el subjecte també l'ha marcada com a prioritària (≡ ×4 a la SVT).
 */
export function weightFor(userImportant: boolean, subjectPriority: boolean): number {
  return (userImportant ? 2 : 1) * (subjectPriority ? 2 : 1);
}

export function computeMatch(
  answers: Readonly<Record<string, UserAnswer | undefined>>,
  subjects: readonly Subject[],
  opts: MatchOptions = {},
): SubjectMatch[] {
  const threshold = opts.coverageThreshold ?? DEFAULT_COVERAGE_THRESHOLD;
  const selected = new Set(opts.selectedThemes ?? []);
  const themes = opts.statementThemes ?? {};

  // Afirmacions que compten: les que l'usuari ha respost amb un valor real.
  const answeredIds = Object.keys(answers).filter((id) => isValue(answers[id]?.value));

  const results = subjects.map((subject): SubjectMatch => {
    const breakdown: StatementBreakdown[] = [];
    let numerator = 0;
    let denominator = 0;
    let known = 0;

    for (const statementId of answeredIds) {
      const answer = answers[statementId]!;
      const userValue = answer.value as Value;
      const userImportant = answer.important === true;
      const position = subject.positions[statementId];
      const kind: PositionKind = !position
        ? "no_data"
        : position.kind === "answered" && !isValue(position.value)
          ? "no_data"
          : position.kind;
      const subjectPriority = position?.priority === true;
      const weight = weightFor(userImportant, subjectPriority);

      if (kind === "no_data") {
        breakdown.push({
          statementId, userValue, userImportant, kind,
          subjectValue: null, subjectPriority, distance: null,
          label: "unknown", weight, score: null,
        });
        continue; // fora del numerador i del denominador d'aquest subjecte
      }

      known += 1;
      denominator += weight * MAX_SCORE;

      if (kind === "no_position") {
        numerator += weight * NO_POSITION_SCORE;
        breakdown.push({
          statementId, userValue, userImportant, kind,
          subjectValue: null, subjectPriority, distance: null,
          label: "unknown", weight, score: NO_POSITION_SCORE,
        });
        continue;
      }

      const subjectValue = position!.value as Value;
      const distance = Math.abs(userValue - subjectValue);
      const score = MAX_SCORE - distance;
      numerator += weight * score;
      breakdown.push({
        statementId, userValue, userImportant, kind,
        subjectValue, subjectPriority, distance,
        label: labelFor(distance), weight, score,
      });
    }

    const answered = answeredIds.length;
    const coverage = answered === 0 ? 0 : known / answered;
    const classified = answered > 0 && coverage >= threshold && denominator > 0;
    const raw = denominator === 0 ? 0 : (100 * numerator) / denominator;
    const matchPct = classified ? Math.min(100, Math.max(0, Math.round(raw))) : null;

    return { subjectId: subject.id, name: subject.name, matchPct, classified, known, answered, coverage, breakdown };
  });

  return sortMatches(results, selected, themes);
}

/**
 * Ordre: primer els classificats per coincidència; empats resolts per (1) encert
 * a les afirmacions marcades com a importants, (2) als temes triats,
 * (3) més cobertura, (4) ordre alfabètic.
 */
function sortMatches(
  results: SubjectMatch[],
  selectedThemes: ReadonlySet<string>,
  statementThemes: Readonly<Record<string, string>>,
): SubjectMatch[] {
  const scoreOn = (m: SubjectMatch, keep: (b: StatementBreakdown) => boolean) => {
    let num = 0;
    let den = 0;
    for (const b of m.breakdown) {
      if (b.score === null || !keep(b)) continue;
      num += b.weight * b.score;
      den += b.weight * MAX_SCORE;
    }
    return den === 0 ? -1 : num / den;
  };

  const collator = new Intl.Collator("ca");
  return [...results].sort((a, b) => {
    if (a.classified !== b.classified) return a.classified ? -1 : 1;
    if (a.classified && b.classified && a.matchPct !== b.matchPct) {
      return (b.matchPct ?? 0) - (a.matchPct ?? 0);
    }
    const imp = scoreOn(b, (x) => x.userImportant) - scoreOn(a, (x) => x.userImportant);
    if (Math.abs(imp) > 1e-9) return imp;
    const inTheme = (x: StatementBreakdown) => selectedThemes.has(statementThemes[x.statementId] ?? "");
    if (selectedThemes.size > 0) {
      const th = scoreOn(b, inTheme) - scoreOn(a, inTheme);
      if (Math.abs(th) > 1e-9) return th;
    }
    if (a.coverage !== b.coverage) return b.coverage - a.coverage;
    return collator.compare(a.name, b.name);
  });
}

/** Subjectes que empaten al capdamunt: la SVT els mostra amb el mateix número. */
export function tiedLeaders(results: readonly SubjectMatch[]): SubjectMatch[] {
  const top = results.find((r) => r.classified);
  if (!top) return [];
  return results.filter((r) => r.classified && r.matchPct === top.matchPct);
}

/**
 * *Shoot-out*: si els dos primers queden a menys de `margin` punts, val la pena
 * oferir afirmacions extra del fons no seleccionat que els separin.
 */
export function needsShootOut(results: readonly SubjectMatch[], margin = 3): boolean {
  const classified = results.filter((r) => r.classified);
  if (classified.length < 2) return false;
  return (classified[0]!.matchPct ?? 0) - (classified[1]!.matchPct ?? 0) <= margin;
}
