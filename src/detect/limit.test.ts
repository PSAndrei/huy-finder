import { describe, expect, it } from 'vitest';
import { limitAnalysis } from './limit';
import type { Analysis } from './analyze';
import type { Letter, Word } from './types';

const letter = (key: string, score: number): Letter => ({ key, score } as unknown as Letter);
const word = (key: string, score: number, letters: Letter[]): Word => ({ key, score, letters } as unknown as Word);

const a = letter('a', 40), b = letter('b', 50), c = letter('c', 60);
const d = letter('d', 95), e = letter('e', 20), f = letter('f', 70);
const analysis = {
  letters: [a, b, c, d, e, f],
  words: [word('w1', 90, [a, b, c]), word('w2', 80, [d, e, f])],
} as unknown as Analysis;

describe('limitAnalysis', () => {
  it('null — без ограничения, тот же объект', () => {
    expect(limitAnalysis(analysis, null)).toBe(analysis);
  });

  it('лимит больше числа слов и букв — тот же объект', () => {
    expect(limitAnalysis(analysis, 10)).toBe(analysis);
  });

  it('оставляет первые N слов и все их буквы, даже если букв больше N', () => {
    const out = limitAnalysis(analysis, 1);
    expect(out.words.map((w) => w.key)).toEqual(['w1']);
    expect(out.letters.map((l) => l.key)).toEqual(['a', 'b', 'c']);
  });

  it('свободные места добирает лучшими одиночными буквами, порядок исходный', () => {
    const out = limitAnalysis(analysis, 4);
    expect(out.words.map((w) => w.key)).toEqual(['w1', 'w2']);
    // 6 букв слов > 4 — все буквы слов, одиночных нет
    expect(out.letters.map((l) => l.key)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);

    const single = { letters: [a, b, c, d, e, f], words: [word('w1', 90, [a, b])] } as unknown as Analysis;
    const out2 = limitAnalysis(single, 4);
    // a, b из слова + две лучшие из c(60), d(95), e(20), f(70) → d, f
    expect(out2.letters.map((l) => l.key)).toEqual(['a', 'b', 'd', 'f']);
  });
});
