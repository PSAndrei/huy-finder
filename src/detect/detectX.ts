import { intersect, length, lineAngle, type Segment } from '../geometry/segments';
import { DEFAULT_OPTIONS, clamp01, letterKey, minScore, tolerance, type DetectOptions, type Letter } from './types';

/** Х: два отрезка разных треков пересекаются под углом 40–140° в средней части обоих. */
export function detectX(segments: Segment[], opts: DetectOptions = DEFAULT_OPTIONS): Letter[] {
  const k = tolerance(opts);
  const minAngle = 40 / k;     // острый угол между прямыми
  const margin = 0.15 / k;     // пересечение в [margin, 1 - margin] длины
  const maxRatio = 3 * k;
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
      if (Math.max(l1, l2) / Math.min(l1, l2) > maxRatio) continue;
      const angle = lineAngle(s1, s2);
      if (angle < minAngle) continue;
      const hit = intersect(s1, s2);
      if (!hit) continue;
      if (hit.t1 < margin || hit.t1 > 1 - margin || hit.t2 < margin || hit.t2 > 1 - margin) continue;

      const angleScore = clamp01(1 - (90 - angle) / 50);
      const midScore = (clamp01(1 - Math.abs(hit.t1 - 0.5) / 0.35) + clamp01(1 - Math.abs(hit.t2 - 0.5) / 0.35)) / 2;
      const score = Math.round((100 * (angleScore + midScore)) / 2);
      if (score < threshold) continue;

      out.push({
        kind: 'X', score, center: hit.point, up: null, size: (l1 + l2) / 2,
        segments: [s1, s2], key: letterKey([s1, s2]),
      });
    }
  }
  return out;
}
