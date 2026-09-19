export const KEY_STORAGE = 'fr24Key';

export type KeyCheck = 'ok' | 'invalid' | 'error';
/** Состояние ключа в приложении. */
export type KeyStatus = 'none' | 'checking' | KeyCheck;

const VERIFY_URL = 'https://fr24api.flightradar24.com/api/static/airlines/AFL/light'; // самый дешёвый запрос: 1 кредит

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Ключ из localStorage; пусто, если нет или хранилище недоступно. */
export function loadKey(store: Storage | null = storage()): string {
  try {
    return store?.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

/** Сохранить ключ; null стирает. Ошибки хранилища глотаем. */
export function saveKey(key: string | null, store: Storage | null = storage()): void {
  try {
    if (key) store?.setItem(KEY_STORAGE, key);
    else store?.removeItem(KEY_STORAGE);
  } catch {
    // приватный режим или запрет хранилища — ключ проживёт только сессию
  }
}

/** Проверка ключа: 200 — ok, 401/403 — invalid, остальное (в том числе сеть) — error. */
export async function verifyKey(key: string, fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)): Promise<KeyCheck> {
  try {
    const res = await fetchFn(VERIFY_URL, {
      headers: { Accept: 'application/json', 'Accept-Version': 'v1', Authorization: `Bearer ${key}` },
    });
    if (res.ok) return 'ok';
    return res.status === 401 || res.status === 403 ? 'invalid' : 'error';
  } catch {
    return 'error';
  }
}
