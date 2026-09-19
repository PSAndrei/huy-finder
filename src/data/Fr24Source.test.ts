import { describe, it, expect, vi } from 'vitest';
import { Fr24Error, Fr24Source } from './Fr24Source';

const bounds = { north: 56.5, south: 55, west: 36, east: 39 };

// Формат light проверен вручную 2026-09-19; поля full — по документации FR24, живьём не проверены.
const sample = {
  data: [
    { fr24_id: '333bd698', hex: 'C8281C', callsign: 'SVR1343', lat: -19.16625, lon: -175.20432, track: 204,
      alt: 40000, gspeed: 491, vspeed: -64, squawk: '2623', timestamp: '2026-09-19T07:57:02Z', source: 'ADSB',
      type: 'A321', painted_as: 'SVR', orig_iata: 'DME', dest_iata: 'MCX' },
  ],
};

describe('Fr24Source', () => {
  it('строит запрос full с границами и заголовками, разбирает ответ', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 }));
    const src = new Fr24Source('KEY', fetchFn as unknown as typeof fetch);
    const res = await src.fetchPositions(bounds, 0);

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://fr24api.flightradar24.com/api/live/flight-positions/full?bounds=56.5,55,36,39');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer KEY');
    expect(headers['Accept-Version']).toBe('v1');

    expect(res).toEqual([{
      id: '333bd698', lat: -19.16625, lon: -175.20432, heading: 204, timestamp: Date.parse('2026-09-19T07:57:02Z'),
      speedKmh: 491 * 1.852,
      info: { callsign: 'SVR1343', airline: 'Ural Airlines', aircraft: 'A321', from: { iata: 'DME', city: '' }, to: { iata: 'MCX', city: '' } },
    }]);
  });

  it('без позывного легенды нет; без типа и аэропортов — прочерки', async () => {
    const data = [
      { ...sample.data[0], fr24_id: 'a', callsign: null },
      { ...sample.data[0], fr24_id: 'b', type: null, painted_as: null, orig_iata: null, dest_iata: null, gspeed: undefined },
    ];
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ data }), { status: 200 }));
    const res = await new Fr24Source('KEY', fetchFn as unknown as typeof fetch).fetchPositions(bounds, 0);
    expect(res[0].info).toBeUndefined();
    expect(res[1].speedKmh).toBe(0);
    expect(res[1].info).toEqual({ callsign: 'SVR1343', airline: 'Ural Airlines', aircraft: '—', from: { iata: '—', city: '' }, to: { iata: '—', city: '' } });
  });

  it('ошибка API — Fr24Error со статусом и сообщением', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ message: 'Credits exhausted' }), { status: 402 }));
    const src = new Fr24Source('KEY', fetchFn as unknown as typeof fetch);
    await expect(src.fetchPositions(bounds, 0)).rejects.toMatchObject({ status: 402, message: 'Credits exhausted' });
    await expect(src.fetchPositions(bounds, 0)).rejects.toBeInstanceOf(Fr24Error);
  });

  it('пустой ответ — пустой список', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const src = new Fr24Source('KEY', fetchFn as unknown as typeof fetch);
    expect(await src.fetchPositions(bounds, 0)).toEqual([]);
  });
});
