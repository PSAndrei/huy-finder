import { describe, it, expect } from 'vitest';
import { MockSource } from './MockSource';
import { mulberry32 } from './random';
import type { Bounds } from './FlightSource';

const bounds: Bounds = { north: 56, south: 54, west: 36, east: 40 };

function distKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (b.lat - a.lat) * 111.32;
  const dLon = (b.lon - a.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

describe('mulberry32', () => {
  it('одно зерно — одна последовательность в [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 5; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('MockSource', () => {
  it('создаёт count рейсов внутри границ', async () => {
    const src = new MockSource(7, 25);
    const p = await src.fetchPositions(bounds, 0);
    expect(p).toHaveLength(25);
    for (const f of p) {
      expect(f.lat).toBeGreaterThanOrEqual(54);
      expect(f.lat).toBeLessThanOrEqual(56);
      expect(f.lon).toBeGreaterThanOrEqual(36);
      expect(f.lon).toBeLessThanOrEqual(40);
      expect(f.timestamp).toBe(0);
    }
  });

  it('одно зерно — одинаковые позиции', async () => {
    const a = new MockSource(3, 10);
    const b = new MockSource(3, 10);
    await a.fetchPositions(bounds, 0);
    await b.fetchPositions(bounds, 0);
    expect(await a.fetchPositions(bounds, 5000)).toEqual(await b.fetchPositions(bounds, 5000));
  });

  it('за минуту рейс пролетает 11–15 км по своему курсу', async () => {
    const src = new MockSource(11, 30);
    const before = await src.fetchPositions(bounds, 0);
    const after = await src.fetchPositions(bounds, 60_000);
    const byId = new Map(after.map((p) => [p.id, p]));
    let checked = 0;
    for (const b of before) {
      const a = byId.get(b.id);
      if (!a) continue; // вылетел за границы и заменён
      const d = distKm(b, a);
      expect(d).toBeGreaterThan(11);
      expect(d).toBeLessThan(15.5);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('вылетевший рейс заменяется новым: число рейсов постоянно', async () => {
    const src = new MockSource(5, 40);
    let now = 0;
    for (let i = 0; i < 30; i++) {
      now += 60_000;
      const p = await src.fetchPositions(bounds, now);
      expect(p).toHaveLength(40);
      for (const f of p) {
        expect(f.lat).toBeGreaterThanOrEqual(54);
        expect(f.lat).toBeLessThanOrEqual(56);
      }
    }
  });

  it('сильный сдвиг области пересоздаёт рейсы', async () => {
    const src = new MockSource(1, 10);
    const a = await src.fetchPositions(bounds, 0);
    const far: Bounds = { north: 46, south: 44, west: 6, east: 10 };
    const b = await src.fetchPositions(far, 5000);
    expect(b).toHaveLength(10);
    expect(b.every((p) => p.lat <= 46 && p.lat >= 44)).toBe(true);
    expect(new Set(b.map((p) => p.id)).size).toBe(10);
    expect(a.map((p) => p.id)).not.toEqual(b.map((p) => p.id));
  });
});
