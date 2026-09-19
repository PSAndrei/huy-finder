import type { Pt } from '../geometry/project';
import { direction, distance, dot, length, lineAngle, midpoint, projectPoint, type Segment } from '../geometry/segments';
import { DEFAULT_OPTIONS, clamp01, letterKey, minScore, tolerance, type DetectOptions, type Letter } from './types';

/** Наименьшее из двух назначений концов диагонали на точки p и q. */
function endMismatch(d: Segment, p: Pt, q: Pt): number {
  const direct = Math.max(distance(d.a, p), distance(d.b, q));
  const swapped = Math.max(distance(d.a, q), distance(d.b, p));
  return Math.min(direct, swapped);
}

/** И: два почти параллельных штриха и диагональ от низа левого к верху правого. */
export function detectI(segments: Segment[], opts: DetectOptions = DEFAULT_OPTIONS): Letter[] {
  const k = tolerance(opts);
  const maxParallelAngle = 25 * k;
  const gapMin = 0.3 / k;
  const gapMax = 1.5 * k;
  const maxLenRatio = 2 * k;
  const endTol = 0.2 * k;
  const threshold = minScore(opts);
  const out: Letter[] = [];

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const s1 = segments[i];
      const s2 = segments[j];
      if (s1.trackId === s2.trackId) continue;
      const l1 = length(s1);
      const l2 = length(s2);
      if (l1 === 0 || l2 === 0) continue;
      if (Math.max(l1, l2) / Math.min(l1, l2) > maxLenRatio) continue;
      const angle = lineAngle(s1, s2);
      if (angle > maxParallelAngle) continue;
      const avg = (l1 + l2) / 2;
      const pr = projectPoint(midpoint(s2), s1);
      if (pr.t < 0 || pr.t > 1) continue;          // штрихи рядом, а не друг за другом
      const gap = pr.dist / avg;
      if (gap < gapMin || gap > gapMax) continue;

      // Берём up вдоль первого штриха. right — перпендикуляр по часовой стрелке.
      const up = direction(s1);
      const right = { x: up.y, y: -up.x };
      const s1IsLeft = dot(midpoint(s1), right) < dot(midpoint(s2), right);
      const left = s1IsLeft ? s1 : s2;
      const rightStroke = s1IsLeft ? s2 : s1;
      const bottomLeft = dot(left.a, up) < dot(left.b, up) ? left.a : left.b;
      const topRight = dot(rightStroke.a, up) > dot(rightStroke.b, up) ? rightStroke.a : rightStroke.b;

      for (const d of segments) {
        if (d.trackId === s1.trackId || d.trackId === s2.trackId) continue;
        const mismatch = endMismatch(d, bottomLeft, topRight);
        if (mismatch > endTol * avg) continue;

        const parallelScore = clamp01(1 - angle / 25);
        const gapScore = clamp01(1 - Math.abs(gap - 0.9) / 0.6);
        const endScore = clamp01(1 - mismatch / (endTol * avg));
        const score = Math.round((100 * (parallelScore + gapScore + endScore)) / 3);
        if (score < threshold) continue;

        const m1 = midpoint(left);
        const m2 = midpoint(rightStroke);
        out.push({
          kind: 'I', score, center: { x: (m1.x + m2.x) / 2, y: (m1.y + m2.y) / 2 }, up, size: avg,
          segments: [left, rightStroke, d], key: letterKey([left, rightStroke, d]),
        });
      }
    }
  }
  return out;
}
