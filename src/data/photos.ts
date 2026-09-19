import type { FlightInfo } from './FlightSource';

export type Photo = { url: string; author: string };

type CommonsPage = {
  index?: number;
  imageinfo?: { thumburl?: string; extmetadata?: { Artist?: { value?: string } } }[];
};

const API = 'https://commons.wikimedia.org/w/api.php';
const MAX_PHOTOS = 2;
const cache = new Map<string, Promise<Photo[]>>();

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim();
}

async function load(query: string, fetchFn: typeof fetch): Promise<Photo[]> {
  const url = `${API}?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=4` +
    `&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640`;
  const res = await fetchFn(url);
  if (!res.ok) return [];
  const body = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } };
  const out: Photo[] = [];
  const pages = Object.values(body.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const page of pages) {
    const ii = page.imageinfo?.[0];
    if (!ii?.thumburl) continue;
    out.push({ url: ii.thumburl, author: stripTags(ii.extmetadata?.Artist?.value ?? '') });
    if (out.length === MAX_PHOTOS) break;
  }
  return out;
}

/** До двух фото по запросу из Wikimedia Commons. Любая ошибка — пустой список. Кэш на модуль. */
export function fetchPhotos(query: string, fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)): Promise<Photo[]> {
  let p = cache.get(query);
  if (!p) {
    p = load(query, fetchFn).catch(() => []);
    cache.set(query, p);
  }
  return p;
}

/** Фото борта: сначала «тип + авиакомпания», если пусто — «тип aircraft». */
export async function fetchAircraftPhotos(info: FlightInfo, fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)): Promise<Photo[]> {
  const exact = await fetchPhotos(`${info.aircraft} ${info.airline}`, fetchFn);
  return exact.length ? exact : fetchPhotos(`${info.aircraft} aircraft`, fetchFn);
}

export function clearPhotoCache(): void {
  cache.clear();
}
