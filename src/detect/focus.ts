import type { Analysis } from './analyze';
import type { Letter, Word } from './types';

/** Борта, чьими отрезками нарисовано слово. */
export function wordTrackIds(word: Word): Set<string> {
  return new Set(word.letters.flatMap((l) => l.segments.map((s) => s.trackId)));
}

function drawnBy(letter: Letter, ids: Set<string>): boolean {
  return letter.segments.every((s) => ids.has(s.trackId));
}

/** Оставляет только буквы и слова, целиком нарисованные бортами из набора. */
export function filterAnalysis(analysis: Analysis, ids: Set<string>): Analysis {
  const letters = analysis.letters.filter((l) => drawnBy(l, ids));
  const words = analysis.words.filter((w) => w.letters.every((l) => drawnBy(l, ids)));
  return { ...analysis, letters, words };
}

/** Одинаковый ли состав бортов. */
export function sameIds(a: Set<string>, b: Set<string> | null): boolean {
  return b !== null && a.size === b.size && [...a].every((id) => b.has(id));
}
