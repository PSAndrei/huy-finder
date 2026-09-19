import { describe, expect, it } from 'vitest';
import { limitAnalysis } from './limit';
import type { Analysis } from './analyze';
import type { Word } from './types';

const word = (key: string, score: number): Word => ({ key, score } as unknown as Word);
const analysis = {
  letters: [], words: [word('a', 90), word('b', 80), word('c', 70)],
} as unknown as Analysis;

describe('limitAnalysis', () => {
  it('оставляет первые N слов, буквы не трогает', () => {
    const out = limitAnalysis(analysis, 2);
    expect(out.words.map((w) => w.key)).toEqual(['a', 'b']);
    expect(out.letters).toBe(analysis.letters);
  });

  it('null — без ограничения, тот же объект', () => {
    expect(limitAnalysis(analysis, null)).toBe(analysis);
  });

  it('лимит больше числа слов — тот же объект', () => {
    expect(limitAnalysis(analysis, 10)).toBe(analysis);
  });
});
