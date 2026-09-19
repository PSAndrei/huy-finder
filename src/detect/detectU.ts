import type { Pt } from '../geometry/project';
import { add, dot, length, lineAngle, norm, projectPoint, scale, sub, type Segment } from '../geometry/segments';
import { DEFAULT_OPTIONS, clamp01, letterKey, minScore, tolerance, type DetectOptions, type Letter } from './types';

/** У: короткий отрезок B упирается концом в среднюю часть длинного A под углом 25–85°. */
export function detectU(segments: Segment[], opts: DetectOptions = DEFAULT_OPTIONS): Letter[] {
  const k = tolerance(opts);
  const maxTouchDist = 0.1 * k;            // доля длины A
  const tMin = 0.3 / k;
  const tMax = 1 - 0.3 / k;
  const ratioMin = 0.25 / k;
  const ratioMax = 0.8 * k;
  const angleMin = 25 / k;
  const angleMax = Math.min(89, 85 * k);
  const threshold = minScore(opts);
  const out: Letter[] = [];

  for (const a of segments) {
    for (const b of segments) {
      if (a === b || a.trackId === b.trackId) continue;
      const la = length(a);
      const lb = length(b);
      if (la === 0 || lb === 0) continue;
      const ratio = lb / la;
      if (ratio < ratioMin || ratio > ratioMax) continue;
      const angle = lineAngle(a, b);
      if (angle < angleMin || angle > angleMax) continue;

      const ends: [Pt, Pt][] = [[b.a, b.b], [b.b, b.a]];
      for (const [touch, far] of ends) {
        const pr = projectPoint(touch, a);
        if (pr.dist > maxTouchDist * la || pr.t < tMin || pr.t > tMax) continue;
        const p = add(a.a, scale(sub(a.b, a.a), pr.t));
        // верхний конец A — по ту же сторону от точки касания, что и дальний конец B
        const armB = norm(sub(far, p));
        const upperA = dot(sub(a.a, p), armB) > 0 ? a.a : a.b;
        const up = norm(add(armB, norm(sub(upperA, p))));

        const angleScore = clamp01(1 - Math.abs(angle - 50) / 35);
        const midScore = clamp01(1 - Math.abs(pr.t - 0.5) / 0.25);
        const score = Math.round((100 * (angleScore + midScore)) / 2);
        if (score < threshold) continue;

        out.push({ kind: 'U', score, center: p, up, size: la, segments: [a, b], key: letterKey([a, b]) });
        break;
      }
    }
  }
  return out;
}
