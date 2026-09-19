import type { Bounds, FlightSource, Position } from './FlightSource';
import type { LatLon } from '../geometry/project';
import { mulberry32 } from './random';

export const KM_PER_DEG = 111.32;
const DEG = Math.PI / 180;

export type Flight = {
  id: string;
  lat: number;
  lon: number;
  heading: number;             // градусы по часовой от севера
  speedKmh: number;
  remainingKm: number | null;  // null — обычный рейс; число — подсаженный, исчезает, когда долетит
  nextTurnAt: number;          // мс
};

/** Сдвинуть точку на km по курсу heading. */
export function moveKm(f: LatLon & { heading: number }, km: number): void {
  const h = f.heading * DEG;
  f.lat += (km * Math.cos(h)) / KM_PER_DEG;
  f.lon += (km * Math.sin(h)) / (KM_PER_DEG * Math.cos(f.lat * DEG));
}

/** Курс из точки a в точку b, градусы по часовой от севера. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const dLat = b.lat - a.lat;
  const dLon = (b.lon - a.lon) * Math.cos(a.lat * DEG);
  return ((Math.atan2(dLon, dLat) / DEG) + 360) % 360;
}

/** Локальные километры (x — восток, y — север) относительно центра → координаты. */
export function localToLatLon(center: LatLon, xKm: number, yKm: number): LatLon {
  return {
    lat: center.lat + yKm / KM_PER_DEG,
    lon: center.lon + xKm / (KM_PER_DEG * Math.cos(center.lat * DEG)),
  };
}

function inside(p: LatLon, b: Bounds): boolean {
  return p.lat >= b.south && p.lat <= b.north && p.lon >= b.west && p.lon <= b.east;
}

function movedFar(prev: Bounds, next: Bounds): boolean {
  const dLat = Math.abs((prev.north + prev.south) / 2 - (next.north + next.south) / 2);
  const dLon = Math.abs((prev.west + prev.east) / 2 - (next.west + next.east) / 2);
  return dLat > (prev.north - prev.south) / 2 || dLon > (prev.east - prev.west) / 2;
}

/** Генератор рейсов: случайные самолёты летят по курсу, иногда поворачивают, за границей заменяются. */
export class MockSource implements FlightSource {
  protected readonly rng: () => number;
  protected flights: Flight[] = [];
  protected bounds: Bounds | null = null;
  private lastNow: number | null = null;
  protected counter = 0;

  constructor(seed = 1, private readonly count = 60) {
    this.rng = mulberry32(seed);
  }

  async fetchPositions(bounds: Bounds, now: number): Promise<Position[]> {
    if (!this.bounds || movedFar(this.bounds, bounds)) {
      this.bounds = bounds;
      this.flights = this.flights.filter((f) => f.remainingKm !== null);
      for (let i = 0; i < this.count; i++) this.flights.push(this.randomFlight(bounds, now));
    }
    const dtH = this.lastNow === null ? 0 : (now - this.lastNow) / 3_600_000;
    this.lastNow = now;

    const next: Flight[] = [];
    for (const f of this.flights) {
      if (f.remainingKm !== null && f.remainingKm <= 0) continue; // подсаженный долетел
      const km = f.speedKmh * dtH;
      if (f.remainingKm !== null) {
        moveKm(f, Math.min(km, f.remainingKm));
        f.remainingKm -= km;
      } else {
        moveKm(f, km);
        if (now >= f.nextTurnAt) {
          const sign = this.rng() < 0.5 ? -1 : 1;
          f.heading = (f.heading + sign * this.range(10, 40) + 360) % 360;
          f.nextTurnAt = now + this.turnDelay();
        }
        if (!inside(f, bounds)) {
          next.push(this.edgeFlight(bounds, now));
          continue;
        }
      }
      next.push(f);
    }
    this.flights = next;
    return this.flights.map((f) => ({ id: f.id, lat: f.lat, lon: f.lon, heading: f.heading, timestamp: now }));
  }

  protected range(min: number, max: number): number {
    return min + (max - min) * this.rng();
  }

  private turnDelay(): number {
    return this.range(3, 5) * 60_000;
  }

  private randomFlight(b: Bounds, now: number): Flight {
    return {
      id: `mock-${this.counter++}`,
      lat: this.range(b.south, b.north),
      lon: this.range(b.west, b.east),
      heading: this.range(0, 360),
      speedKmh: this.range(700, 900),
      remainingKm: null,
      nextTurnAt: now + this.turnDelay(),
    };
  }

  /** Новый рейс на случайном краю области, летит внутрь. */
  private edgeFlight(b: Bounds, now: number): Flight {
    const side = Math.floor(this.range(0, 4));
    const start: LatLon =
      side === 0 ? { lat: b.north, lon: this.range(b.west, b.east) } :
      side === 1 ? { lat: b.south, lon: this.range(b.west, b.east) } :
      side === 2 ? { lat: this.range(b.south, b.north), lon: b.west } :
                   { lat: this.range(b.south, b.north), lon: b.east };
    const target: LatLon = { lat: this.range(b.south, b.north), lon: this.range(b.west, b.east) };
    return {
      id: `mock-${this.counter++}`,
      lat: start.lat,
      lon: start.lon,
      heading: bearingDeg(start, target),
      speedKmh: this.range(700, 900),
      remainingKm: null,
      nextTurnAt: now + this.turnDelay(),
    };
  }
}
