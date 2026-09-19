import { describe, it, expect } from 'vitest';
import { simplify, toSegments } from './simplify';

describe('simplify', () => {
  it('почти прямая схлопывается в два конца', () => {
    const pts = [0, 1, 2, 3, 4, 5].map((i) => ({ x: i * 1000, y: (i % 2) * 10 }));
    expect(simplify(pts, 100)).toEqual([pts[0], pts[5]]);
  });

  it('излом сохраняется', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 2000, y: 0 },
      { x: 2000, y: 1000 }, { x: 2000, y: 2000 },
    ];
    expect(simplify(pts, 100)).toEqual([pts[0], pts[2], pts[4]]);
  });

  it('две точки и меньше не меняются', () => {
    expect(simplify([{ x: 0, y: 0 }], 10)).toEqual([{ x: 0, y: 0 }]);
    expect(simplify([], 10)).toEqual([]);
  });

  it('toSegments нумерует отрезки', () => {
    const segs = toSegments([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], 'abc');
    expect(segs.map((s) => s.id)).toEqual(['abc#0', 'abc#1']);
    expect(segs.every((s) => s.trackId === 'abc')).toBe(true);
    expect(segs[1].a).toEqual({ x: 1, y: 0 });
  });
});
