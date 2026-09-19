import type { Pt } from '../geometry/project';
import type { Segment } from '../geometry/segments';

export type LetterKind = 'X' | 'U' | 'I';
export const LETTER_CHAR: Record<LetterKind, string> = { X: 'Х', U: 'У', I: 'Й' };

export type Letter = {
  kind: LetterKind;
  score: number;        // 0–100
  center: Pt;
  up: Pt | null;        // единичный вектор «верх». У Х нет. У И два варианта: up и -up
  size: number;         // метры
  segments: Segment[];
  key: string;          // отсортированные id отрезков
};

export type Grade = 'perfect' | 'good' | 'crooked' | 'anagram';
export const GRADE_LABEL: Record<Grade, string> = {
  perfect: 'Эталонный', good: 'Годный', crooked: 'Кривой', anagram: 'Анаграмма',
};

export type Word = {
  letters: [Letter, Letter, Letter]; // в порядке чтения
  text: string;                      // 'ХУЙ', 'ЙУХ', ...
  correctOrder: boolean;
  score: number;                     // 0–100
  grade: Grade;
  center: Pt;
  up: Pt;
  key: string;
};

/** sensitivity от -1 (строго) до 1 (щедро). */
export type DetectOptions = { sensitivity: number };
export const DEFAULT_OPTIONS: DetectOptions = { sensitivity: 0 };

/** Коэффициент допусков: 1 при нуле, 1.3 при щедрой, 0.7 при строгой. */
export function tolerance(opts: DetectOptions): number {
  return 1 + 0.3 * Math.max(-1, Math.min(1, opts.sensitivity));
}

export function minScore(opts: DetectOptions): number {
  return 30 / tolerance(opts);
}

export function letterKey(segments: Segment[]): string {
  return segments.map((s) => s.id).sort().join('|');
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
