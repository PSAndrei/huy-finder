import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearPhotoCache, fetchAircraftPhotos, fetchPhotos } from './photos';

const page = (id: number, url: string, index: number, artist?: string) => ({
  [id]: { pageid: id, index, imageinfo: [{ thumburl: url, extmetadata: artist ? { Artist: { value: artist } } : {} }] },
});
const ok = (pages: object) => new Response(JSON.stringify({ query: { pages } }), { status: 200 });

describe('photos', () => {
  beforeEach(() => clearPhotoCache());

  it('берёт первые два фото по рангу поиска и автора без тегов', async () => {
    const fetchFn = vi.fn(async () => ok({
      ...page(1, 'https://u/1.jpg', 3, '<a href="x">Gleb Salko</a>'),
      ...page(2, 'https://u/2.jpg', 1),
      ...page(3, 'https://u/3.jpg', 2, 'Third'),
    }));
    const res = await fetchPhotos('A321 Ural Airlines', fetchFn as unknown as typeof fetch);
    expect(res).toEqual([{ url: 'https://u/2.jpg', author: '' }, { url: 'https://u/3.jpg', author: 'Third' }]);
    const [url] = fetchFn.mock.calls[0] as unknown as [string];
    expect(url).toContain('commons.wikimedia.org/w/api.php');
    expect(url).toContain('gsrsearch=A321%20Ural%20Airlines');
    expect(url).toContain('origin=*');
  });

  it('ошибка сети или не-2xx — пустой список', async () => {
    const boom = vi.fn(async () => { throw new Error('offline'); });
    expect(await fetchPhotos('q1', boom as unknown as typeof fetch)).toEqual([]);
    const bad = vi.fn(async () => new Response('nope', { status: 500 }));
    expect(await fetchPhotos('q2', bad as unknown as typeof fetch)).toEqual([]);
  });

  it('повторный запрос берётся из кэша', async () => {
    const fetchFn = vi.fn(async () => ok(page(1, 'https://u/1.jpg', 1)));
    await fetchPhotos('same', fetchFn as unknown as typeof fetch);
    await fetchPhotos('same', fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('fetchAircraftPhotos: сначала борт и авиакомпания, при пустом ответе — только борт', async () => {
    const fetchFn = vi.fn(async (url: string) => (url.includes('Ural') ? ok({}) : ok(page(1, 'https://u/a321.jpg', 1))));
    const info = { callsign: 'SVR1', airline: 'Ural Airlines', aircraft: 'A321', from: { iata: 'DME', city: '' }, to: { iata: 'MCX', city: '' } };
    const res = await fetchAircraftPhotos(info, fetchFn as unknown as typeof fetch);
    expect(res).toEqual([{ url: 'https://u/a321.jpg', author: '' }]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect((fetchFn.mock.calls[1] as unknown as [string])[0]).toContain('gsrsearch=A321%20aircraft');
  });
});
