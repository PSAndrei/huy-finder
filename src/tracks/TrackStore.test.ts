import { describe, it, expect } from 'vitest';
import { TrackStore } from './TrackStore';
import type { Position } from '../data/FlightSource';

const pos = (id: string, lat: number, lon: number): Position => ({ id, lat, lon, heading: 0, timestamp: 0, speedKmh: 0 });

describe('TrackStore', () => {
  it('склеивает позиции одного id в трек по порядку', () => {
    const s = new TrackStore();
    s.add([pos('a', 1, 1), pos('b', 5, 5)], 1000);
    s.add([pos('a', 2, 2)], 2000);
    const a = s.tracks().find((t) => t.id === 'a')!;
    expect(a.points).toEqual([{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }]);
    expect(a.lastSeen).toBe(2000);
    expect(s.tracks()).toHaveLength(2);
  });

  it('запоминает курс последней позиции', () => {
    const s = new TrackStore();
    s.add([{ ...pos('a', 1, 1), heading: 90 }], 1000);
    s.add([{ ...pos('a', 2, 2), heading: 180 }], 2000);
    expect(s.tracks()[0].heading).toBe(180);
  });

  it('хранит скорость и последнюю непустую легенду', () => {
    const s = new TrackStore();
    const info = { callsign: 'AFL1', airline: 'Aeroflot', aircraft: 'A320', from: { iata: 'SVO', city: 'Moscow' }, to: { iata: 'LED', city: 'Saint Petersburg' } };
    s.add([{ ...pos('a', 1, 1), speedKmh: 800, info }], 1000);
    s.add([{ ...pos('a', 2, 2), speedKmh: 850 }], 2000);
    const t = s.tracks()[0];
    expect(t.speedKmh).toBe(850);
    expect(t.info).toEqual(info);
    expect(s.tracks().find((x) => x.id === 'a')!.info).toEqual(info);
  });

  it('без легенды info равен null', () => {
    const s = new TrackStore();
    s.add([pos('a', 1, 1)], 1000);
    expect(s.tracks()[0].info).toBeNull();
  });

  it('повтор той же точки не добавляется', () => {
    const s = new TrackStore();
    s.add([pos('a', 1, 1)], 1000);
    s.add([pos('a', 1, 1)], 2000);
    expect(s.tracks()[0].points).toHaveLength(1);
  });

  it('удаляет протухшие треки', () => {
    const s = new TrackStore({ maxAgeMs: 1000 });
    s.add([pos('a', 1, 1)], 0);
    s.add([pos('b', 1, 1)], 500);
    s.add([], 1400);
    expect(s.tracks().map((t) => t.id)).toEqual(['b']);
  });

  it('обрезает длинные треки с начала', () => {
    const s = new TrackStore({ maxPoints: 3 });
    for (let i = 0; i < 5; i++) s.add([pos('a', i, i)], i);
    expect(s.tracks()[0].points.map((p) => p.lat)).toEqual([2, 3, 4]);
  });

  it('clear очищает всё', () => {
    const s = new TrackStore();
    s.add([pos('a', 1, 1)], 0);
    s.clear();
    expect(s.tracks()).toEqual([]);
  });
});
