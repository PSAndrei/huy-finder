import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useScanner } from './useScanner';
import { Fr24Error } from '../data/Fr24Source';
import type { FlightSource, Position } from '../data/FlightSource';

const bounds = { north: 56, south: 54, west: 36, east: 40 };

function stubSource(impl: () => Promise<Position[]>): FlightSource {
  return { fetchPositions: impl };
}

function setup(source: FlightSource, intervalMs = 1000) {
  return useScanner({
    source: ref(source),
    getBounds: () => bounds,
    intervalMs: ref(intervalMs),
    sensitivity: ref(0),
  });
}

describe('useScanner', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('tick складывает позиции и считает анализ', async () => {
    const s = setup(stubSource(async () => [
      { id: 'a', lat: 55, lon: 37, heading: 0, timestamp: 0 },
    ]));
    await s.tick();
    expect(s.tracks.value).toHaveLength(1);
    expect(s.analysis.value).not.toBeNull();
    expect(s.error.value).toBeNull();
  });

  it('start опрашивает по интервалу, stop прекращает', async () => {
    const fetch = vi.fn(async () => [] as Position[]);
    const s = setup(stubSource(fetch), 1000);
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetch).toHaveBeenCalledTimes(3);
    s.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(s.status.value).toBe('idle');
  });

  it('сетевая ошибка: сообщение записано, опрос продолжается, после трёх ошибок интервал растёт', async () => {
    const fetch = vi.fn(async () => { throw new Error('network down'); });
    const s = setup(stubSource(fetch), 1000);
    s.start();
    await vi.advanceTimersByTimeAsync(0);       // 1-я ошибка → следующий через 1000
    await vi.advanceTimersByTimeAsync(1000);    // 2-я → через 1000
    await vi.advanceTimersByTimeAsync(1000);    // 3-я → через 2000
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(s.error.value).toBe('network down');
    expect(s.status.value).toBe('running');
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(3);     // ещё рано
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(4);
    s.stop();
  });

  it('401/402/403 останавливает опрос', async () => {
    const fetch = vi.fn(async () => { throw new Fr24Error(402, 'Credits exhausted'); });
    const s = setup(stubSource(fetch), 1000);
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(s.status.value).toBe('stopped-error');
    expect(s.error.value).toBe('402: Credits exhausted');
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reset очищает треки и анализ', async () => {
    const s = setup(stubSource(async () => [{ id: 'a', lat: 55, lon: 37, heading: 0, timestamp: 0 }]));
    await s.tick();
    s.reset();
    expect(s.tracks.value).toEqual([]);
    expect(s.analysis.value).toBeNull();
  });

  it('ручной tick во время работы не удваивает опрос', async () => {
    const fetch = vi.fn(async () => [] as Position[]);
    const s = setup(stubSource(fetch), 5000);
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    // Ручной tick на 2000 ms
    await vi.advanceTimersByTimeAsync(2000);
    await s.tick();
    expect(fetch).toHaveBeenCalledTimes(2);
    // Продвигаем на 5000 ms (total 7000) → первый запланированный tick с 5000 ms срабатывает
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(3);
    // Продвигаем на 5000 ms ещё (total 12000) → следующий tick срабатывает
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(4);
    s.stop();
  });

  it('stop/start во время незавершённого запроса не порождает второй цикл', async () => {
    const fetch = vi.fn(async () => {
      return new Promise<Position[]>(resolve => {
        setTimeout(() => resolve([]), 3000);
      });
    });
    const s = setup(stubSource(fetch), 5000);
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    s.stop();
    s.start();
    await vi.advanceTimersByTimeAsync(2000);
    // первый fetch разрешается после 3000 от начала, но был инвалидирован stop
    // новых fetch вызовов не будет, т.к. второй tick при inFlight=true вернулся сразу
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    // После инвалидации и разрешения первого fetch, цепь не восстановилась
    expect(fetch).toHaveBeenCalledTimes(1);
    s.stop();
    await vi.advanceTimersByTimeAsync(20000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
