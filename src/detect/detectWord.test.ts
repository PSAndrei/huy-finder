import { describe, it, expect } from 'vitest';
import { detectWord } from './detectWord';
import type { Letter, LetterKind } from './types';

let n = 0;
function letter(kind: LetterKind, x: number, y: number, up: { x: number; y: number } | null, score = 100, size = 1): Letter {
  n++;
  return { kind, score, center: { x, y }, up, size, segments: [], key: `k${n}` };
}

describe('detectWord', () => {
  it('идеальное ХУЙ в ряд — эталонный', () => {
    const res = detectWord([
      letter('X', -1.3, 0, null),
      letter('U', 0, 0, { x: 0, y: 1 }),
      letter('I', 1.3, 0, { x: 0, y: 1 }),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].text).toBe('ХУЙ');
    expect(res[0].correctOrder).toBe(true);
    expect(res[0].score).toBeGreaterThanOrEqual(90);
    expect(res[0].grade).toBe('perfect');
  });

  it('ХУЙ под наклоном 45° тоже находится', () => {
    const up = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
    const right = { x: up.y, y: -up.x };
    const at = (k: number) => ({ x: right.x * k, y: right.y * k });
    const res = detectWord([
      letter('X', at(-1.3).x, at(-1.3).y, null),
      letter('U', 0, 0, up),
      letter('I', at(1.3).x, at(1.3).y, up),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].text).toBe('ХУЙ');
  });

  it('ЙХУ в ряд — анаграмма с оценкой не выше 60', () => {
    const res = detectWord([
      letter('I', -1.3, 0, { x: 0, y: 1 }),
      letter('X', 0, 0, null),
      letter('U', 1.3, 0, { x: 0, y: 1 }),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].text).toBe('ЙХУ');
    expect(res[0].correctOrder).toBe(false);
    expect(res[0].grade).toBe('anagram');
    expect(res[0].score).toBeLessThanOrEqual(60);
  });

  it('И перевёрнутая (up вниз) всё равно подходит и разворачивается', () => {
    const i = letter('I', 1.3, 0, { x: 0, y: -1 });
    const res = detectWord([letter('X', -1.3, 0, null), letter('U', 0, 0, { x: 0, y: 1 }), i]);
    expect(res).toHaveLength(1);
    expect(i.up!.y).toBeCloseTo(1);
  });

  it('разный наклон У и И — не слово', () => {
    const res = detectWord([
      letter('X', -1.3, 0, null),
      letter('U', 0, 0, { x: 0, y: 1 }),
      letter('I', 1.3, 0, { x: 1, y: 0 }),
    ]);
    expect(res).toEqual([]);
  });

  it('буквы не в ряд — не слово', () => {
    const res = detectWord([
      letter('X', -1.3, 1.5, null),
      letter('U', 0, 0, { x: 0, y: 1 }),
      letter('I', 1.3, 0, { x: 0, y: 1 }),
    ]);
    expect(res).toEqual([]);
  });

  it('слишком далеко друг от друга — не слово', () => {
    const res = detectWord([
      letter('X', -5, 0, null),
      letter('U', 0, 0, { x: 0, y: 1 }),
      letter('I', 5, 0, { x: 0, y: 1 }),
    ]);
    expect(res).toEqual([]);
  });

  it('слабые буквы и кривой ряд дают слово ниже 40 — не показываем', () => {
    const res = detectWord([
      letter('X', -1.3, 0.45, null, 10),
      letter('U', 0, 0, { x: 0, y: 1 }, 10),
      letter('I', 1.3, -0.45, { x: 0, y: 1 }, 10),
    ]);
    expect(res).toEqual([]);
  });
});
