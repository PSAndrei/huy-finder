import { describe, it, expect, vi } from 'vitest';
import { Fr24Error, Fr24Source } from './Fr24Source';

const bounds = { north: 56.5, south: 55, west: 36, east: 39 };

// Формат ответа сендбокса, проверен вручную 2026-09-19.
const sample = {
  data: [
    { fr24_id: '333bd698', hex: 'C8281C', callsign: 'ANZ23', lat: -19.16625, lon: -175.20432, track: 204,
      alt: 40000, gspeed: 491, vspeed: -64, squawk: '2623', timestamp: '2026-09-19T07:57:02Z', source: 'ADSB' },
  ],
};

describe('Fr24Source', () => {
  it('строит запрос с границами и заголовками, разбирает ответ', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 }));
    const src = new Fr24Source('KEY', fetchFn as unknown as typeof fetch);
    const res = await src.fetchPositions(bounds, 0);

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://fr24api.flightradar24.com/api/live/flight-positions/light?bounds=56.5,55,36,39');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer KEY');
    expect(headers['Accept-Version']).toBe('v1');

    expect(res).toEqual([{
      id: '333bd698', lat: -19.16625, lon: -175.20432, heading: 204, timestamp: Date.parse('2026-09-19T07:57:02Z'),
    }]);
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
