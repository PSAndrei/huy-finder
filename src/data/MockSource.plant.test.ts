import { describe, it, expect } from 'vitest';
import { MockSource } from './MockSource';
import { TrackStore } from '../tracks/TrackStore';
import { analyze } from '../detect/analyze';
import type { Bounds } from './FlightSource';

const bounds: Bounds = { north: 56, south: 54, west: 36, east: 40 };

/** Гоняет источник шагами по 5 с, складывает в TrackStore, возвращает анализ. */
async function fly(src: MockSource, steps: number) {
  const store = new TrackStore();
  let now = 0;
  for (let i = 0; i < steps; i++) {
    now += 5000;
    store.add(await src.fetchPositions(bounds, now), now);
  }
  return analyze(store.tracks(), bounds);
}

describe('MockSource.plant', () => {
  it('без границ подсадка невозможна', () => {
    expect(new MockSource(1, 0).plantLetter('X')).toBe(false);
  });

  it('подсаженная Х находится детектором', async () => {
    const src = new MockSource(2, 0);
    await src.fetchPositions(bounds, 0);
    expect(src.plantLetter('X')).toBe(true);
    const res = await fly(src, 60);
    expect(res.letters.some((l) => l.kind === 'X' && l.score > 70)).toBe(true);
  });

  it('подсаженная У и И находятся', async () => {
    for (const kind of ['U', 'I'] as const) {
      const src = new MockSource(3, 0);
      await src.fetchPositions(bounds, 0);
      src.plantLetter(kind);
      const res = await fly(src, 60);
      expect(res.letters.some((l) => l.kind === kind && l.score > 70)).toBe(true);
    }
  });

  it('подсаженное слово собирается в ХУЙ', async () => {
    for (const seed of [4, 5, 6]) {
      const src = new MockSource(seed, 0);
      await src.fetchPositions(bounds, 0);
      expect(src.plantWord()).toBe(true);
      const res = await fly(src, 60);
      const word = res.words.find((w) => w.correctOrder);
      expect(word, `seed ${seed}`).toBeDefined();
      expect(word!.score).toBeGreaterThanOrEqual(70);
    }
  });

  it('долетевшие подсаженные рейсы исчезают из позиций', async () => {
    const src = new MockSource(7, 0);
    await src.fetchPositions(bounds, 0);
    src.plantLetter('X');
    let now = 0;
    for (let i = 0; i < 120; i++) {
      now += 5000;
      await src.fetchPositions(bounds, now);
    }
    expect(await src.fetchPositions(bounds, now + 5000)).toEqual([]);
  });
});

describe('MockSource.plant — скорость', () => {
  /** Сколько минут до исчезновения всех подсаженных рейсов. */
  async function minutesUntilGone(b: Bounds): Promise<number> {
    const src = new MockSource(8, 0);
    await src.fetchPositions(b, 0);
    src.plantLetter('X');
    let now = 0;
    for (let i = 0; i < 600; i++) {
      now += 5000;
      if ((await src.fetchPositions(b, now)).length === 0) return now / 60_000;
    }
    return Infinity;
  }

  it('самый длинный штрих дорисовывается за 1.5–2 минуты при любой высоте области', async () => {
    const small: Bounds = { north: 55.5, south: 54.5, west: 36, east: 38 };
    const large: Bounds = { north: 61, south: 50, west: 22, east: 53 };
    for (const b of [small, large]) {
      const m = await minutesUntilGone(b);
      expect(m, `bounds ${b.north - b.south}°`).toBeGreaterThanOrEqual(1.5);
      expect(m, `bounds ${b.north - b.south}°`).toBeLessThanOrEqual(2);
    }
  });
});
