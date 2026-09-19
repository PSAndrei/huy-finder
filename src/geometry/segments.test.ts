import { describe, it, expect } from 'vitest';
import {
  type Segment, length, lineAngle, intersect, projectPoint, direction, angleDeg, midpoint,
} from './segments';

function seg(ax: number, ay: number, bx: number, by: number, trackId = 't'): Segment {
  return { id: `${trackId}#${ax},${ay}`, trackId, a: { x: ax, y: ay }, b: { x: bx, y: by } };
}

describe('segments', () => {
  it('длина и середина', () => {
    const s = seg(0, 0, 3, 4);
    expect(length(s)).toBe(5);
    expect(midpoint(s)).toEqual({ x: 1.5, y: 2 });
  });

  it('направление единичное', () => {
    const d = direction(seg(0, 0, 0, 5));
    expect(d.x).toBeCloseTo(0);
    expect(d.y).toBeCloseTo(1);
  });

  it('угол между векторами', () => {
    expect(angleDeg({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
    expect(angleDeg({ x: 1, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(180);
  });

  it('острый угол между прямыми не зависит от направления', () => {
    expect(lineAngle(seg(0, 0, 1, 0), seg(0, 0, 0, 1))).toBeCloseTo(90);
    expect(lineAngle(seg(0, 0, 1, 0), seg(5, 0, 0, 0))).toBeCloseTo(0);
    expect(lineAngle(seg(0, 0, 1, 1), seg(0, 0, -1, 0))).toBeCloseTo(45);
  });

  it('пересечение крестом в середине', () => {
    const hit = intersect(seg(-1, -1, 1, 1), seg(-1, 1, 1, -1));
    expect(hit).not.toBeNull();
    expect(hit!.point.x).toBeCloseTo(0);
    expect(hit!.point.y).toBeCloseTo(0);
    expect(hit!.t1).toBeCloseTo(0.5);
    expect(hit!.t2).toBeCloseTo(0.5);
  });

  it('параллельные и непересекающиеся дают null', () => {
    expect(intersect(seg(0, 0, 1, 0), seg(0, 1, 1, 1))).toBeNull();
    expect(intersect(seg(0, 0, 1, 0), seg(2, -1, 2, 1))).toBeNull();
  });

  it('проекция точки на отрезок', () => {
    const s = seg(0, 0, 10, 0);
    expect(projectPoint({ x: 3, y: 2 }, s)).toEqual({ t: 0.3, dist: 2 });
    const beyond = projectPoint({ x: 13, y: 4 }, s);
    expect(beyond.t).toBeCloseTo(1.3);
    expect(beyond.dist).toBeCloseTo(5);
  });
});
