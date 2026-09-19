import type { LatLon } from '../geometry/project';
import type { Position } from '../data/FlightSource';

export type Track = { id: string; points: LatLon[]; lastSeen: number; heading: number };

type Options = { maxAgeMs: number; maxPoints: number };

/** Склеивает позиции в треки по id. Удаляет треки без обновлений, обрезает длинные. */
export class TrackStore {
  private readonly map = new Map<string, Track>();
  private readonly opts: Options;

  constructor(opts: Partial<Options> = {}) {
    this.opts = { maxAgeMs: 600_000, maxPoints: 200, ...opts };
  }

  add(positions: Position[], now: number): void {
    for (const p of positions) {
      let t = this.map.get(p.id);
      if (!t) {
        t = { id: p.id, points: [], lastSeen: now, heading: p.heading };
        this.map.set(p.id, t);
      }
      const last = t.points[t.points.length - 1];
      if (!last || last.lat !== p.lat || last.lon !== p.lon) t.points.push({ lat: p.lat, lon: p.lon });
      if (t.points.length > this.opts.maxPoints) t.points.splice(0, t.points.length - this.opts.maxPoints);
      t.lastSeen = now;
      t.heading = p.heading;
    }
    for (const [id, t] of this.map) {
      if (now - t.lastSeen > this.opts.maxAgeMs) this.map.delete(id);
    }
  }

  tracks(): Track[] {
    return [...this.map.values()];
  }

  clear(): void {
    this.map.clear();
  }
}
