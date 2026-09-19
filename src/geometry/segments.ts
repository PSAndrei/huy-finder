import { DEG, type Pt } from './project';

export type Segment = { id: string; trackId: string; a: Pt; b: Pt };

export function sub(p: Pt, q: Pt): Pt { return { x: p.x - q.x, y: p.y - q.y }; }
export function add(p: Pt, q: Pt): Pt { return { x: p.x + q.x, y: p.y + q.y }; }
export function scale(p: Pt, k: number): Pt { return { x: p.x * k, y: p.y * k }; }
export function neg(p: Pt): Pt { return { x: -p.x, y: -p.y }; }
export function dot(p: Pt, q: Pt): number { return p.x * q.x + p.y * q.y; }
export function distance(p: Pt, q: Pt): number { return Math.hypot(q.x - p.x, q.y - p.y); }

export function norm(p: Pt): Pt {
  const l = Math.hypot(p.x, p.y);
  return l === 0 ? { x: 0, y: 0 } : { x: p.x / l, y: p.y / l };
}

export function length(s: Segment): number { return distance(s.a, s.b); }
export function midpoint(s: Segment): Pt { return { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 }; }
export function direction(s: Segment): Pt { return norm(sub(s.b, s.a)); }

/** Угол между векторами в градусах, 0–180. */
export function angleDeg(u: Pt, v: Pt): number {
  const c = Math.max(-1, Math.min(1, dot(norm(u), norm(v))));
  return Math.acos(c) / DEG;
}

/** Острый угол между прямыми отрезков, 0–90. Направление не важно. */
export function lineAngle(s1: Segment, s2: Segment): number {
  const a = angleDeg(direction(s1), direction(s2));
  return a > 90 ? 180 - a : a;
}

/** Пересечение отрезков. t1, t2 — доля длины от a к b. null, если не пересекаются или параллельны. */
export function intersect(s1: Segment, s2: Segment): { point: Pt; t1: number; t2: number } | null {
  const r = sub(s1.b, s1.a);
  const s = sub(s2.b, s2.a);
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-12) return null;
  const qp = sub(s2.a, s1.a);
  const t1 = (qp.x * s.y - qp.y * s.x) / den;
  const t2 = (qp.x * r.y - qp.y * r.x) / den;
  if (t1 < 0 || t1 > 1 || t2 < 0 || t2 > 1) return null;
  return { point: add(s1.a, scale(r, t1)), t1, t2 };
}

/** Проекция точки на прямую отрезка. t — доля длины (может быть вне 0–1), dist — расстояние до ближайшей точки отрезка. */
export function projectPoint(p: Pt, s: Segment): { t: number; dist: number } {
  const r = sub(s.b, s.a);
  const len2 = dot(r, r);
  if (len2 === 0) return { t: 0, dist: distance(p, s.a) };
  const t = dot(sub(p, s.a), r) / len2;
  const tc = Math.max(0, Math.min(1, t));
  return { t, dist: distance(p, add(s.a, scale(r, tc))) };
}
