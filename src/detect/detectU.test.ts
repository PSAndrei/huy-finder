import { describe, it, expect } from 'vitest';
import { detectU } from './detectU';
import { seg } from './testUtils';

// Длинный штрих A наклонён на 25° от вертикали вправо, короткий B — зеркально влево, касается A в середине.
const A = () => seg(-0.233, -0.5, 0.233, 0.5);
const B = () => seg(-0.233, 0.5, 0, 0);

describe('detectU', () => {
  it('идеальная У — оценка выше 90, верх смотрит вверх', () => {
    const res = detectU([A(), B()]);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe('U');
    expect(res[0].score).toBeGreaterThan(90);
    expect(res[0].up!.x).toBeCloseTo(0, 2);
    expect(res[0].up!.y).toBeCloseTo(1, 2);
    expect(res[0].center.x).toBeCloseTo(0, 2);
    expect(res[0].center.y).toBeCloseTo(0, 2);
  });

  it('касание не в середине — оценка между 30 и 90', () => {
    // точка касания на 35% длины A: (-0.07, -0.15)
    const res = detectU([A(), seg(-0.303, 0.35, -0.07, -0.15)]);
    expect(res).toHaveLength(1);
    expect(res[0].score).toBeGreaterThanOrEqual(30);
    expect(res[0].score).toBeLessThanOrEqual(90);
  });

  it('Т, V и крест — не У', () => {
    expect(detectU([seg(-1, 0, 1, 0), seg(0, 0, 0, 0.5)])).toEqual([]);            // Т: угол 90
    expect(detectU([seg(0, 0, 0, 1), seg(0, 0, 0.5, 0.5)])).toEqual([]);            // V: касание в конце A
    expect(detectU([seg(-1, -1, 1, 1), seg(-0.6, 0.6, 0.6, -0.6)])).toEqual([]);    // крест: концы B далеко от A
  });

  it('отрезки одного трека не берём', () => {
    expect(detectU([seg(-0.233, -0.5, 0.233, 0.5, 'same'), seg(-0.233, 0.5, 0, 0, 'same')])).toEqual([]);
  });
});
