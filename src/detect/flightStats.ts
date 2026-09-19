import type { Analysis } from './analyze';
import type { Grade, LetterKind } from './types';

/** Что нарисовал один борт: его буквы, слова с этими буквами и итоговая «хуёвость». */
export type FlightStats = {
  letters: { kind: LetterKind; score: number }[];
  words: { text: string; score: number; grade: Grade }[];
  score: number; // 0–100: лучшее слово, иначе лучшая буква, иначе 0
};

export function flightStats(analysis: Analysis | null, trackId: string): FlightStats {
  if (!analysis) return { letters: [], words: [], score: 0 };
  const mine = analysis.letters.filter((l) => l.segments.some((s) => s.trackId === trackId));
  const keys = new Set(mine.map((l) => l.key));
  const letters = [...mine]
    .sort((a, b) => b.score - a.score)
    .map((l) => ({ kind: l.kind, score: l.score }));
  const words = analysis.words
    .filter((w) => w.letters.some((l) => keys.has(l.key)))
    .sort((a, b) => b.score - a.score)
    .map((w) => ({ text: w.text, score: w.score, grade: w.grade }));
  return { letters, words, score: words[0]?.score ?? letters[0]?.score ?? 0 };
}
