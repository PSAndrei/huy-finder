import { describe, it, expect } from 'vitest';
import { detectX } from './detectX';
import { seg } from './testUtils';

describe('detectX', () => {
  it('идеальный крест — оценка выше 90', () => {
    const res = detectX([seg(-1, -1, 1, 1), seg(-1, 1, 1, -1)]);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe('X');
    expect(res[0].score).toBeGreaterThan(90);
    expect(res[0].center.x).toBeCloseTo(0);
    expect(res[0].center.y).toBeCloseTo(0);
    expect(res[0].up).toBeNull();
  });

  it('косой крест — оценка между 30 и 90', () => {
    const res = detectX([seg(-1, -1, 1, 1), seg(-1, 0.6, 1, -0.6)]);
    expect(res).toHaveLength(1);
    expect(res[0].score).toBeGreaterThanOrEqual(30);
    expect(res[0].score).toBeLessThanOrEqual(90);
  });

  it('параллельные, V и Т — не крест', () => {
    expect(detectX([seg(0, 0, 1, 0), seg(0, 1, 1, 1)])).toEqual([]);
    expect(detectX([seg(0, 0, 1, 1), seg(0, 0, 1, -1)])).toEqual([]);
    expect(detectX([seg(-1, 0, 1, 0), seg(0, 0, 0, 1)])).toEqual([]);
  });

  it('слишком острый угол — не крест', () => {
    expect(detectX([seg(-1, 0, 1, 0), seg(-1, -0.3, 1, 0.3)])).toEqual([]);
  });

  it('отрезки одного трека не берём', () => {
    expect(detectX([seg(-1, -1, 1, 1, 'same'), seg(-1, 1, 1, -1, 'same')])).toEqual([]);
  });

  it('щедрая чувствительность пропускает более острый угол', () => {
    const segs = [seg(-1, 0, 1, 0), seg(-1, -0.7, 1, 0.7)]; // около 35°
    expect(detectX(segs, { sensitivity: 0 })).toEqual([]);
    expect(detectX(segs, { sensitivity: 1 })).toHaveLength(1);
  });
});
