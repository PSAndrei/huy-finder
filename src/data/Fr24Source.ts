import type { Bounds, FlightSource, Position } from './FlightSource';

export class Fr24Error extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'Fr24Error';
  }
}

type RawPosition = { fr24_id: string; lat: number; lon: number; track: number; timestamp: string };

/** Адаптер Flightradar24 API. Один запрос позиций в прямоугольнике. Не проверен на боевом ключе. */
export class Fr24Source implements FlightSource {
  constructor(
    private readonly key: string,
    private readonly fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly baseUrl = 'https://fr24api.flightradar24.com/api/',
  ) {}

  async fetchPositions(bounds: Bounds, _now: number): Promise<Position[]> {
    const url = `${this.baseUrl}live/flight-positions/light?bounds=${bounds.north},${bounds.south},${bounds.west},${bounds.east}`;
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
    }));
  }
}
