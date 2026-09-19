import { describe, it, expect, vi } from 'vitest';
import { KEY_STORAGE, loadKey, saveKey, verifyKey } from './fr24Key';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => { data[k] = v; },
    removeItem: (k: string) => { delete data[k]; },
  } as unknown as Storage & { data: Record<string, string> };
}

describe('loadKey / saveKey', () => {
  it('читает сохранённый ключ, без него — пусто', () => {
    expect(loadKey(fakeStorage({ [KEY_STORAGE]: 'abc' }))).toBe('abc');
    expect(loadKey(fakeStorage())).toBe('');
  });

  it('сохраняет ключ и стирает по null', () => {
    const s = fakeStorage();
    saveKey('abc', s);
    expect(s.data[KEY_STORAGE]).toBe('abc');
    saveKey(null, s);
    expect(s.data[KEY_STORAGE]).toBeUndefined();
  });

  it('недоступное хранилище не роняет приложение', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(loadKey(broken)).toBe('');
    expect(() => saveKey('abc', broken)).not.toThrow();
  });
});

describe('verifyKey', () => {
  it('зовёт airlines light с ключом; 200 — ok', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ name: 'Aeroflot', iata: 'SU', icao: 'AFL' }), { status: 200 }));
    expect(await verifyKey('KEY', fetchFn as unknown as typeof fetch)).toBe('ok');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://fr24api.flightradar24.com/api/static/airlines/AFL/light');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer KEY');
    expect(headers['Accept-Version']).toBe('v1');
  });

  it('401 и 403 — invalid', async () => {
    for (const status of [401, 403]) {
      const fetchFn = vi.fn(async () => new Response('{}', { status }));
      expect(await verifyKey('KEY', fetchFn as unknown as typeof fetch)).toBe('invalid');
    }
  });

  it('другой статус или сбой сети — error', async () => {
    const fetch500 = vi.fn(async () => new Response('{}', { status: 500 }));
    expect(await verifyKey('KEY', fetch500 as unknown as typeof fetch)).toBe('error');
    const fetchDown = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect(await verifyKey('KEY', fetchDown as unknown as typeof fetch)).toBe('error');
  });
});
