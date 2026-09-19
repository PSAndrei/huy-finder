import type { Pt } from './project';
import { projectPoint, type Segment } from './segments';

/** Дуглас-Пекер: убирает точки, отклоняющиеся от хорды меньше чем на toleranceM. */
export function simplify(points: Pt[], toleranceM: number): Pt[] {
  if (points.length <= 2) return points.slice();
  const first = points[0];
  const last = points[points.length - 1];
  const chord: Segment = { id: '', trackId: '', a: first, b: last };
  let maxDist = 0;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = projectPoint(points[i], chord).dist;
    if (d > maxDist) { maxDist = d; idx = i; }
  }
  if (maxDist <= toleranceM) return [first, last];
  const left = simplify(points.slice(0, idx + 1), toleranceM);
  const right = simplify(points.slice(idx), toleranceM);
  return left.slice(0, -1).concat(right);
}

export function toSegments(points: Pt[], trackId: string): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    out.push({ id: `${trackId}#${i}`, trackId, a: points[i], b: points[i + 1] });
  }
  return out;
}
