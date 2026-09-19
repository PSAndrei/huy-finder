import { describe, it, expect } from 'vitest';
import { detectI } from './detectI';
import { seg } from './testUtils';

const L = () => seg(-0.4, -0.5, -0.4, 0.5);
const R = () => seg(0.4, -0.5, 0.4, 0.5);

describe('detectI', () => {
  it('идеальная И — оценка выше 90', () => {
    const res = detectI([L(), R(), seg(-0.4, -0.5, 0.4, 0.5)]);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe('I');
    expect(res[0].score).toBeGreaterThan(90);
    expect(res[0].center.x).toBeCloseTo(0);
    expect(res[0].center.y).toBeCloseTo(0);
    expect(Math.abs(res[0].up!.y)).toBeCloseTo(1);
    expect(res[0].segments).toHaveLength(3);
  });

  it('диагональ не доходит до углов — оценка между 30 и 90', () => {
    const res = detectI([L(), R(), seg(-0.4, -0.4, 0.4, 0.4)]);
    expect(res).toHaveLength(1);
    expect(res[0].score).toBeGreaterThanOrEqual(30);
    expect(res[0].score).toBeLessThanOrEqual(90);
  });

  it('обратная диагональ (N) — не И', () => {
    expect(detectI([L(), R(), seg(-0.4, 0.5, 0.4, -0.5)])).toEqual([]);
  });

  it('две параллельные без диагонали — не И', () => {
    expect(detectI([L(), R()])).toEqual([]);
  });

  it('штрихи друг за другом, а не рядом — не И', () => {
    expect(detectI([seg(0, 0, 0, 1), seg(0, 2, 0, 3), seg(0, 0, 0, 3)])).toEqual([]);
  });

  it('диагональ того же трека, что штрих — не И', () => {
    expect(detectI([seg(-0.4, -0.5, -0.4, 0.5, 'same'), R(), seg(-0.4, -0.5, 0.4, 0.5, 'same')])).toEqual([]);
  });
});
