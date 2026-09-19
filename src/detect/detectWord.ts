import { angleDeg, distance, dot, neg } from '../geometry/segments';
import {
  DEFAULT_OPTIONS, LETTER_CHAR, clamp01, tolerance,
  type DetectOptions, type Grade, type Letter, type Word,
} from './types';

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function gradeOf(score: number, correctOrder: boolean): Grade {
  if (!correctOrder) return 'anagram';
  if (score >= 90) return 'perfect';
  if (score >= 70) return 'good';
  return 'crooked';
}

/** Слово: по одной Х, У, И в ряд с общим «верхом». Порядок влияет на оценку и grade. */
export function detectWord(letters: Letter[], opts: DetectOptions = DEFAULT_OPTIONS): Word[] {
  const k = tolerance(opts);
  const maxUpAngle = 35 * k;
  const maxRowDev = 0.5 * k;        // доля среднего размера
  const maxSizeRatio = 2.5 * k;
  const distMin = 0.5 / k;          // расстояние между центрами соседей, доли среднего размера
  const distMax = 3 * k;

  const xs = letters.filter((l) => l.kind === 'X');
  const us = letters.filter((l) => l.kind === 'U' && l.up);
  const is = letters.filter((l) => l.kind === 'I' && l.up);
  const seen = new Set<string>();
  const out: Word[] = [];

  for (const u of us) {
    const up = u.up!;
    const right = { x: up.y, y: -up.x };
    for (const i of is) {
      // И симметрична: подходит и up, и -up
      const flipped = angleDeg(up, neg(i.up!)) < angleDeg(up, i.up!);
      const upAngle = angleDeg(up, flipped ? neg(i.up!) : i.up!);
      if (upAngle > maxUpAngle) continue;
      for (const x of xs) {
        const trio = [x, u, i];
        const sizes = trio.map((l) => l.size);
        const avgSize = mean(sizes);
        if (Math.max(...sizes) / Math.min(...sizes) > maxSizeRatio) continue;

        const offs = trio.map((l) => dot(l.center, up));
        const meanOff = mean(offs);
        const maxDev = Math.max(...offs.map((o) => Math.abs(o - meanOff)));
        if (maxDev > maxRowDev * avgSize) continue;

        const ordered = [...trio].sort((p, q) => dot(p.center, right) - dot(q.center, right)) as [Letter, Letter, Letter];
        const d1 = distance(ordered[0].center, ordered[1].center);
        const d2 = distance(ordered[1].center, ordered[2].center);
        if (d1 < distMin * avgSize || d1 > distMax * avgSize) continue;
        if (d2 < distMin * avgSize || d2 > distMax * avgSize) continue;

        const text = ordered.map((l) => LETTER_CHAR[l.kind]).join('');
        const correctOrder = text === 'ХУЙ';

        const straight = clamp01(1 - maxDev / (maxRowDev * avgSize));
        const upMatch = clamp01(1 - upAngle / maxUpAngle);
        const sizeEq = Math.min(...sizes) / Math.max(...sizes);
        const gapEq = 1 - Math.abs(d1 - d2) / Math.max(d1, d2);
        const accuracy = (straight + upMatch + sizeEq + gapEq) / 4;
        let score = 0.6 * mean(trio.map((l) => l.score)) + 0.4 * 100 * accuracy;
        if (!correctOrder) score *= 0.6;
        score = Math.round(score);
        if (correctOrder && score < 40) continue;

        const key = trio.map((l) => l.key).sort().join('||');
        if (seen.has(key)) continue;
        seen.add(key);

        if (flipped) i.up = neg(i.up!);
        out.push({
          letters: ordered, text, correctOrder, score, grade: gradeOf(score, correctOrder),
          center: { x: mean(trio.map((l) => l.center.x)), y: mean(trio.map((l) => l.center.y)) },
          up, key,
        });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
