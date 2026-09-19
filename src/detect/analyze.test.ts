import { describe, it, expect } from 'vitest';
import { analyze } from './analyze';
import type { Track } from '../tracks/TrackStore';

const bounds = { north: 56, south: 54, west: 36, east: 40 };

// Прямой трек из нескольких точек между двумя координатами.
function track(id: string, from: [number, number], to: [number, number], n = 5): Track {
  const points = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    points.push({ lat: from[0] + (to[0] - from[0]) * t, lon: from[1] + (to[1] - from[1]) * t });
  }
  return { id, points, lastSeen: 0 };
}

describe('analyze', () => {
  it('два пересекающихся трека дают крест и ни одного слова', () => {
    const res = analyze([
      track('a', [54.5, 37], [55.5, 39]),
      track('b', [55.5, 37], [54.5, 39]),
    ], bounds);
    expect(res.segmentCount).toBe(2);
    expect(res.letters.map((l) => l.kind)).toEqual(['X']);
    expect(res.words).toEqual([]);
  });

  it('треки из одной точки пропускаются', () => {
    const res = analyze([{ id: 'a', points: [{ lat: 55, lon: 37 }], lastSeen: 0 }], bounds);
    expect(res.segmentCount).toBe(0);
  });
});
