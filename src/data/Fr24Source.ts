import type { Bounds, FlightSource, Position } from './FlightSource';
import { airlineName } from './legend';

export class Fr24Error extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'Fr24Error';
  }
}

type RawPosition = {
  fr24_id: string; lat: number; lon: number; track: number; timestamp: string;
  gspeed?: number | null;          // узлы
  callsign?: string | null; type?: string | null; painted_as?: string | null;
  orig_iata?: string | null; dest_iata?: string | null;
};

const KMH_PER_KNOT = 1.852;
const NONE = '—';

/** Адаптер Flightradar24 API. Один запрос позиций в прямоугольнике. Не проверен на боевом ключе. */
export class Fr24Source implements FlightSource {
  constructor(
    private readonly key: string,
    private readonly fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly baseUrl = 'https://fr24api.flightradar24.com/api/',
  ) {}

  async fetchPositions(bounds: Bounds, _now: number): Promise<Position[]> {
    const url = `${this.baseUrl}live/flight-positions/full?bounds=${bounds.north},${bounds.south},${bounds.west},${bounds.east}`;
    const res = await this.fetchFn(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Version': 'v1',
        Authorization: `Bearer ${this.key}`,
      },
    });
    if (!res.ok) {
      let message = res.statusText || `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        // тело не JSON — оставляем statusText
      }
      throw new Fr24Error(res.status, message);
    }
    const body = (await res.json()) as { data?: RawPosition[] };
    return (body.data ?? []).map((r) => ({
      id: r.fr24_id,
      lat: r.lat,
      lon: r.lon,
      heading: r.track,
      timestamp: Date.parse(r.timestamp),
      speedKmh: (r.gspeed ?? 0) * KMH_PER_KNOT,
      info: r.callsign ? {
        callsign: r.callsign,
        airline: airlineName(r.painted_as ?? r.callsign.slice(0, 3)),
        aircraft: r.type ?? NONE,
        from: { iata: r.orig_iata ?? NONE, city: '' },
        to: { iata: r.dest_iata ?? NONE, city: '' },
      } : undefined,
    }));
  }
}
