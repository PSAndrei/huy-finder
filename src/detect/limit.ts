import type { Analysis } from './analyze';

/**
 * Оставляет не больше limit лучших слов (они уже отсортированы по оценке) и не больше limit букв:
 * буквы показанных слов всегда, остальные места — лучшим одиночным буквам. null — всё.
 */
export function limitAnalysis(analysis: Analysis, limit: number | null): Analysis {
  if (limit === null) return analysis;
  if (analysis.words.length <= limit && analysis.letters.length <= limit) return analysis;
  const words = analysis.words.slice(0, limit);
  const inWords = new Set(words.flatMap((w) => w.letters.map((l) => l.key)));
  const spare = analysis.letters
    .filter((l) => !inWords.has(l.key))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit - inWords.size));
  const keep = new Set([...inWords, ...spare.map((l) => l.key)]);
  const letters = analysis.letters.filter((l) => keep.has(l.key));
  return { ...analysis, letters, words };
}
