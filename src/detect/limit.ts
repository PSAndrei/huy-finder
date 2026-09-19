import type { Analysis } from './analyze';

/** Оставляет не больше limit лучших слов (они уже отсортированы по оценке). null — все. */
export function limitAnalysis(analysis: Analysis, limit: number | null): Analysis {
  if (limit === null || analysis.words.length <= limit) return analysis;
  return { ...analysis, words: analysis.words.slice(0, limit) };
}
