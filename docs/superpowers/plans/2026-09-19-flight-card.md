# Flight Card, Live Planes and Zoom — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Самолёты на карте выглядят живыми (zoom 8, плотность от площади, плавное движение), клик по самолёту открывает карточку рейса с легендой, фото и блоком «хуёвости».

**Architecture:** Легенда рейса (`FlightInfo`) рождается в источнике (`MockSource` выдумывает, `Fr24Source` берёт из `full`) и едет через `Position` в `Track`. Карта сама экстраполирует иконки по курсу и скорости между опросами. Чистая функция `flightStats` вычисляет по `Analysis`, что нарисовал борт. `App.vue` держит выбранный рейс и отдаёт карточке трек, фото и статистику.

**Tech Stack:** Vite, Vue 3 (script setup, TypeScript), MapLibre GL 6, Vitest. Фото — Wikimedia Commons API без ключа.

**Spec:** `docs/superpowers/specs/2026-09-19-flight-card-design.md`

## Global Constraints

- Язык интерфейса и комментариев — русский. Имена в коде — английские.
- Модули `geometry/`, `detect/`, `tracks/`, `data/` не импортируют Vue и MapLibre.
- Тесты — Vitest, файлы `*.test.ts` рядом с кодом. Компоненты Vue тестами не покрываем.
- Детекторы, пороги, шум подсадки (5%, ±2°) и STROKES не трогать.
- Легенда рейсов в генераторе берётся из **отдельного** генератора случайных чисел `mulberry32(seed + 1)`, чтобы не сдвинуть последовательность геометрии и не сломать тесты подсадки на зёрнах 4, 5, 6 (уточнение спеки §5).
- Коммит после каждой задачи. Последняя строка сообщения коммита: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` после пустой строки.
- `Position.speedKmh` обязателен; `Position.info` необязателен. `Track.speedKmh` и `Track.info: FlightInfo | null` обязательны.
- Плотность генератора: `clamp(round(areaKm2 / 600), 30, 120)`; `count` конструктора — верхняя граница, по умолчанию 120.
- Экстраполяция иконок: раз в 100 мс, прошедшее время ограничено 60 000 мс.
- Wikimedia URL и поля — из спеки §7 дословно. Ошибки фото не показываются пользователю: пустой список.

---

### Task 1: Типы легенды и `legend.ts`

**Files:**
- Modify: `src/data/FlightSource.ts`
- Create: `src/data/legend.ts`, `src/data/legend.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Airport = { iata: string; city: string };
  type FlightInfo = { callsign: string; airline: string; aircraft: string; from: Airport; to: Airport };
  // Position получает speedKmh: number и info?: FlightInfo — ЭТО ДЕЛАЕТ TASK 3, здесь только типы Airport/FlightInfo
  function makeFlightInfo(rng: () => number): FlightInfo;
  function airlineName(prefix: string): string;
  const AIRLINES, AIRCRAFT, AIRPORTS
  ```

- [ ] **Step 1: Типы**

Добавить в начало `src/data/FlightSource.ts` (перед `Position`):

```ts
export type Airport = { iata: string; city: string };

/** Легенда рейса: что показываем в карточке. */
export type FlightInfo = {
  callsign: string;   // 'SVR1343'
  airline: string;    // 'Ural Airlines'
  aircraft: string;   // 'A321'
  from: Airport;
  to: Airport;
};
```

- [ ] **Step 2: Тест**

`src/data/legend.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { AIRLINES, AIRPORTS, airlineName, makeFlightInfo } from './legend';
import { mulberry32 } from './random';

describe('legend', () => {
  it('одно зерно — одна легенда', () => {
    expect(makeFlightInfo(mulberry32(5))).toEqual(makeFlightInfo(mulberry32(5)));
  });

  it('позывной начинается с префикса авиакомпании, аэропорты разные', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const info = makeFlightInfo(mulberry32(seed));
      const airline = AIRLINES.find((a) => a.name === info.airline)!;
      expect(info.callsign.startsWith(airline.prefix)).toBe(true);
      expect(Number(info.callsign.slice(airline.prefix.length))).toBeGreaterThanOrEqual(100);
      expect(info.from.iata).not.toBe(info.to.iata);
      expect(AIRPORTS).toContainEqual(info.from);
    }
  });

  it('airlineName: имя по префиксу, иначе сам префикс', () => {
    expect(airlineName('SVR')).toBe('Ural Airlines');
    expect(airlineName('ZZZ')).toBe('ZZZ');
  });
});
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npx vitest run src/data/legend.test.ts`
Expected: FAIL — `Cannot find module './legend'`.

- [ ] **Step 4: Реализация**

`src/data/legend.ts`:
```ts
import type { Airport, FlightInfo } from './FlightSource';

/** Реальные авиакомпании и их позывные-префиксы. */
export const AIRLINES: { name: string; prefix: string }[] = [
  { name: 'Aeroflot', prefix: 'AFL' }, { name: 'S7 Airlines', prefix: 'SBI' },
  { name: 'Ural Airlines', prefix: 'SVR' }, { name: 'Pobeda', prefix: 'PBD' },
  { name: 'UTair', prefix: 'UTA' }, { name: 'Rossiya', prefix: 'SDM' },
  { name: 'Nordwind', prefix: 'NWS' }, { name: 'Azur Air', prefix: 'AZV' },
  { name: 'Turkish Airlines', prefix: 'THY' }, { name: 'Emirates', prefix: 'UAE' },
  { name: 'Belavia', prefix: 'BRU' }, { name: 'Air Astana', prefix: 'KZR' },
];

export const AIRCRAFT = ['A320', 'A321', 'A319', 'B737', 'B738', 'B77W', 'A350', 'SU95'];

export const AIRPORTS: Airport[] = [
  { iata: 'SVO', city: 'Moscow' }, { iata: 'DME', city: 'Moscow' }, { iata: 'VKO', city: 'Moscow' },
  { iata: 'LED', city: 'Saint Petersburg' }, { iata: 'KZN', city: 'Kazan' }, { iata: 'SVX', city: 'Yekaterinburg' },
  { iata: 'AER', city: 'Sochi' }, { iata: 'KRR', city: 'Krasnodar' }, { iata: 'MCX', city: 'Makhachkala' },
  { iata: 'UFA', city: 'Ufa' }, { iata: 'KUF', city: 'Samara' }, { iata: 'ROV', city: 'Rostov-on-Don' },
  { iata: 'GOJ', city: 'Nizhny Novgorod' }, { iata: 'OVB', city: 'Novosibirsk' }, { iata: 'MRV', city: 'Mineralnye Vody' },
  { iata: 'IST', city: 'Istanbul' }, { iata: 'DXB', city: 'Dubai' }, { iata: 'MSQ', city: 'Minsk' },
  { iata: 'ALA', city: 'Almaty' }, { iata: 'TAS', city: 'Tashkent' },
];

function index(rng: () => number, n: number): number {
  return Math.floor(rng() * n);
}

/** Выдуманная, но правдоподобная легенда. Одно зерно rng — одна легенда. */
export function makeFlightInfo(rng: () => number): FlightInfo {
  const airline = AIRLINES[index(rng, AIRLINES.length)];
  const aircraft = AIRCRAFT[index(rng, AIRCRAFT.length)];
  const fromIdx = index(rng, AIRPORTS.length);
  const toIdx = (fromIdx + 1 + index(rng, AIRPORTS.length - 1)) % AIRPORTS.length; // всегда другой аэропорт
  const number = 100 + index(rng, 9900);
  return {
    callsign: `${airline.prefix}${number}`,
    airline: airline.name,
    aircraft,
    from: AIRPORTS[fromIdx],
    to: AIRPORTS[toIdx],
  };
}

/** Имя авиакомпании по префиксу позывного; неизвестный префикс возвращается как есть. */
export function airlineName(prefix: string): string {
  return AIRLINES.find((a) => a.prefix === prefix)?.name ?? prefix;
}
```

- [ ] **Step 5: Тест проходит, typecheck**

Run: `npx vitest run src/data/legend.test.ts && npm run typecheck`
Expected: PASS, 3 теста; typecheck чистый.

- [ ] **Step 6: Commit**

```bash
git add src/data/FlightSource.ts src/data/legend.ts src/data/legend.test.ts
git commit -m "feat(data): flight legend types and generator"
```

---

### Task 2: `pointAhead` в geometry

**Files:**
- Modify: `src/geometry/project.ts`, `src/geometry/project.test.ts`
- Modify: `src/data/MockSource.ts` (функция `moveKm` через `pointAhead`)

**Interfaces:**
- Produces: `function pointAhead(p: LatLon, headingDeg: number, km: number): LatLon` — точка в km по курсу (градусы по часовой от севера).

- [ ] **Step 1: Тест**

Добавить в конец `src/geometry/project.test.ts` (импорт `pointAhead` добавить к существующему импорту из `./project`):
```ts
describe('pointAhead', () => {
  it('111.32 км на север — плюс градус широты', () => {
    const p = pointAhead({ lat: 55, lon: 37 }, 0, 111.32);
    expect(p.lat).toBeCloseTo(56, 6);
    expect(p.lon).toBeCloseTo(37, 6);
  });

  it('на восток на экваторе — плюс градус долготы', () => {
    const p = pointAhead({ lat: 0, lon: 10 }, 90, 111.32);
    expect(p.lat).toBeCloseTo(0, 6);
    expect(p.lon).toBeCloseTo(11, 6);
  });

  it('ноль километров — та же точка', () => {
    expect(pointAhead({ lat: 55, lon: 37 }, 123, 0)).toEqual({ lat: 55, lon: 37 });
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/geometry/project.test.ts`
Expected: FAIL — `pointAhead` не экспортируется.

- [ ] **Step 3: Реализация**

Добавить в конец `src/geometry/project.ts`:
```ts
const KM_PER_DEG = 111.32;

/** Точка в km по курсу headingDeg (по часовой от севера). Долгота масштабируется по новой широте. */
export function pointAhead(p: LatLon, headingDeg: number, km: number): LatLon {
  const h = headingDeg * DEG;
  const lat = p.lat + (km * Math.cos(h)) / KM_PER_DEG;
  const lon = p.lon + (km * Math.sin(h)) / (KM_PER_DEG * Math.cos(lat * DEG));
  return { lat, lon };
}
```

В `src/data/MockSource.ts` заменить тело `moveKm` (сигнатуру и экспорт оставить):
```ts
/** Сдвинуть точку на km по курсу heading. */
export function moveKm(f: LatLon & { heading: number }, km: number): void {
  const q = pointAhead(f, f.heading, km);
  f.lat = q.lat;
  f.lon = q.lon;
}
```
и добавить импорт: `import { pointAhead, type LatLon } from '../geometry/project';` (заменив прежний `import type { LatLon } ...`).

- [ ] **Step 4: Тесты проходят**

Run: `npx vitest run src/geometry src/data && npm run typecheck`
Expected: PASS, все тесты генератора по-прежнему зелёные (формула та же).

- [ ] **Step 5: Commit**

```bash
git add src/geometry/project.ts src/geometry/project.test.ts src/data/MockSource.ts
git commit -m "feat(geometry): pointAhead; mock movement reuses it"
```

---

### Task 3: `Position.speedKmh/info`, `Track.speedKmh/info`

**Files:**
- Modify: `src/data/FlightSource.ts`, `src/tracks/TrackStore.ts`, `src/tracks/TrackStore.test.ts`
- Modify (только литералы в тестах): `src/composables/useScanner.test.ts`, `src/detect/analyze.test.ts`, `src/map/geojson.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Position = { id; lat; lon; heading; timestamp; speedKmh: number; info?: FlightInfo };
  type Track = { id; points; lastSeen; heading; speedKmh: number; info: FlightInfo | null };
  ```
- Consumes: `FlightInfo` (Task 1).

- [ ] **Step 1: Тест**

Добавить в `src/tracks/TrackStore.test.ts` после теста «запоминает курс последней позиции»:
```ts
  it('хранит скорость и последнюю непустую легенду', () => {
    const s = new TrackStore();
    const info = { callsign: 'AFL1', airline: 'Aeroflot', aircraft: 'A320', from: { iata: 'SVO', city: 'Moscow' }, to: { iata: 'LED', city: 'Saint Petersburg' } };
    s.add([{ ...pos('a', 1, 1), speedKmh: 800, info }], 1000);
    s.add([{ ...pos('a', 2, 2), speedKmh: 850 }], 2000);
    const t = s.tracks()[0];
    expect(t.speedKmh).toBe(850);
    expect(t.info).toEqual(info);
    expect(s.tracks().find((x) => x.id === 'a')!.info).toEqual(info);
  });

  it('без легенды info равен null', () => {
    const s = new TrackStore();
    s.add([pos('a', 1, 1)], 1000);
    expect(s.tracks()[0].info).toBeNull();
  });
```
И заменить помощник `pos` в этом файле на:
```ts
const pos = (id: string, lat: number, lon: number): Position => ({ id, lat, lon, heading: 0, timestamp: 0, speedKmh: 0 });
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/tracks/TrackStore.test.ts`
Expected: FAIL — `speedKmh` undefined.

- [ ] **Step 3: Реализация**

`src/data/FlightSource.ts`, тип `Position` целиком:
```ts
export type Position = {
  id: string;
  lat: number;
  lon: number;
  heading: number;   // градусы по часовой от севера
  timestamp: number; // мс
  speedKmh: number;
  info?: FlightInfo; // у FR24 light и в тестах может отсутствовать
};
```

`src/tracks/TrackStore.ts`:
```ts
import type { LatLon } from '../geometry/project';
import type { FlightInfo, Position } from '../data/FlightSource';

export type Track = {
  id: string;
  points: LatLon[];
  lastSeen: number;
  heading: number;
  speedKmh: number;
  info: FlightInfo | null; // последняя непустая легенда
};
```
В `add`: при создании `t = { id: p.id, points: [], lastSeen: now, heading: p.heading, speedKmh: p.speedKmh, info: p.info ?? null };`
и после `t.heading = p.heading;` добавить:
```ts
      t.speedKmh = p.speedKmh;
      if (p.info) t.info = p.info;
```

Литералы в тестах (typecheck иначе падает):
- `src/composables/useScanner.test.ts` строка с `{ id: 'a', lat: 55, lon: 37, heading: 0, timestamp: 0 }` → добавить `, speedKmh: 0`.
- `src/detect/analyze.test.ts`: оба литерала `Track` — добавить `, speedKmh: 0, info: null`.
- `src/map/geojson.test.ts`: все литералы `Track` (в тестах треков и самолётов) — добавить `, speedKmh: 0, info: null`.

- [ ] **Step 4: Тесты и typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, все тесты зелёные, typecheck чистый.

- [ ] **Step 5: Commit**

```bash
git add src/data/FlightSource.ts src/tracks/TrackStore.ts src/tracks/TrackStore.test.ts src/composables/useScanner.test.ts src/detect/analyze.test.ts src/map/geojson.test.ts
git commit -m "feat(tracks): speed and flight legend on positions and tracks"
```

---

### Task 4: Генератор — легенда, скорость, плотность, смена масштаба

**Files:**
- Modify: `src/data/MockSource.ts`, `src/data/MockSource.test.ts`

**Interfaces:**
- Consumes: `makeFlightInfo`, `mulberry32`, `FlightInfo`.
- Produces: `new MockSource(seed = 1, count = 120)`; позиции с `speedKmh` и `info`; число рейсов `min(count, clamp(round(areaKm2/600), 30, 120))`; пересоздание при сдвиге центра больше половины размера ИЛИ при изменении высоты области больше чем вдвое.

- [ ] **Step 1: Тест**

Добавить в `src/data/MockSource.test.ts` внутрь `describe('MockSource')`:
```ts
  it('позиции несут скорость и легенду, легенда постоянна для рейса', async () => {
    const src = new MockSource(9, 5);
    const a = await src.fetchPositions(bounds, 0);
    const b = await src.fetchPositions(bounds, 5000);
    for (const p of a) {
      expect(p.speedKmh).toBeGreaterThanOrEqual(700);
      expect(p.speedKmh).toBeLessThanOrEqual(900);
      expect(p.info!.callsign).toMatch(/^[A-Z]{3}\d{3,4}$/);
      expect(b.find((q) => q.id === p.id)?.info).toEqual(p.info);
    }
  });

  it('число рейсов зависит от площади: один борт на 600 км², от 30 до 120', async () => {
    // 200 × 300 км на широте 55° → 60 000 км² → 100 рейсов
    const mid: Bounds = { north: 55.9, south: 54.1, west: 34.65, east: 39.35 };
    expect(await new MockSource(1).fetchPositions(mid, 0)).toHaveLength(100);
    // 111 × 64 км → ~7 000 км² → нижняя граница 30
    const small: Bounds = { north: 55.5, south: 54.5, west: 36.5, east: 37.5 };
    expect(await new MockSource(1).fetchPositions(small, 0)).toHaveLength(30);
    // 2 000 × 1 900 км → верхняя граница 120
    const huge: Bounds = { north: 64, south: 46, west: 22, east: 52 };
    expect(await new MockSource(1).fetchPositions(huge, 0)).toHaveLength(120);
    // явный count — верхняя граница
    expect(await new MockSource(1, 10).fetchPositions(mid, 0)).toHaveLength(10);
  });

  it('изменение высоты области вдвое пересоздаёт рейсы', async () => {
    const src = new MockSource(2, 10);
    const a = await src.fetchPositions(bounds, 0);
    const zoomedOut: Bounds = { north: 58, south: 52, west: 30, east: 46 }; // тот же центр, высота ×3
    const b = await src.fetchPositions(zoomedOut, 5000);
    expect(a.map((p) => p.id)).not.toEqual(b.map((p) => p.id));
    const c = await src.fetchPositions(zoomedOut, 10_000);
    expect(b.map((p) => p.id)).toEqual(c.map((p) => p.id)); // без смены масштаба не пересоздаёт
  });
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/data/MockSource.test.ts`
Expected: FAIL — `speedKmh`/`info` undefined, длины не совпадают.

- [ ] **Step 3: Реализация**

В `src/data/MockSource.ts`:

Импорт: `import { makeFlightInfo } from './legend';` и `import type { Bounds, FlightInfo, FlightSource, Position } from './FlightSource';`.

Константы после `PLANT_STROKE_MINUTES`:
```ts
const KM2_PER_FLIGHT = 600;
const MIN_FLIGHTS = 30;
const MAX_FLIGHTS = 120;
```

`Flight` получает поле `info: FlightInfo;` (после `heading`).

Функции модуля (рядом с `movedFar`):
```ts
function areaKm2(b: Bounds): number {
  const midLat = (b.north + b.south) / 2;
  return (b.north - b.south) * KM_PER_DEG * (b.east - b.west) * KM_PER_DEG * Math.cos(midLat * DEG);
}

/** Сколько бортов уместно в области: один на 600 км², но не меньше 30 и не больше 120. */
function flightsFor(b: Bounds): number {
  return Math.min(MAX_FLIGHTS, Math.max(MIN_FLIGHTS, Math.round(areaKm2(b) / KM2_PER_FLIGHT)));
}

function rescaled(prev: Bounds, next: Bounds): boolean {
  const ratio = (next.north - next.south) / (prev.north - prev.south);
  return ratio > 2 || ratio < 0.5;
}
```

Класс:
```ts
export class MockSource implements FlightSource {
  protected readonly rng: () => number;
  private readonly legendRng: () => number; // отдельный, чтобы не сдвигать геометрию подсадки
  protected flights: Flight[] = [];
  protected bounds: Bounds | null = null;
  private lastNow: number | null = null;
  protected counter = 0;

  constructor(seed = 1, private readonly count = MAX_FLIGHTS) {
    this.rng = mulberry32(seed);
    this.legendRng = mulberry32(seed + 1);
  }

  async fetchPositions(bounds: Bounds, now: number): Promise<Position[]> {
    if (!this.bounds || movedFar(this.bounds, bounds) || rescaled(this.bounds, bounds)) {
      this.bounds = bounds;
      this.flights = this.flights.filter((f) => f.remainingKm !== null);
      const n = Math.min(this.count, flightsFor(bounds));
      for (let i = 0; i < n; i++) this.flights.push(this.randomFlight(bounds, now));
    }
    ...
```
Возврат позиций:
```ts
    return this.flights.map((f) => ({
      id: f.id, lat: f.lat, lon: f.lon, heading: f.heading, timestamp: now, speedKmh: f.speedKmh, info: f.info,
    }));
```
В `randomFlight`, `edgeFlight` и в объекте внутри `plantStrokes` добавить поле `info: makeFlightInfo(this.legendRng),`.

- [ ] **Step 4: Тесты**

Run: `npx vitest run src/data && npm run typecheck`
Expected: PASS, включая старые тесты подсадки на зёрнах 4, 5, 6 (геометрический `rng` не изменился). Если тест «число рейсов» расходится на ±1 из-за округления площади — поправить ожидаемые границы теста `mid` (например `toBeGreaterThanOrEqual(98)` и `toBeLessThanOrEqual(102)`), не формулу.

- [ ] **Step 5: Commit**

```bash
git add src/data/MockSource.ts src/data/MockSource.test.ts
git commit -m "feat(data): mock flights carry legend and speed; density by area; regenerate on zoom"
```

---

### Task 5: Адаптер FR24 — endpoint `full`

**Files:**
- Modify: `src/data/Fr24Source.ts`, `src/data/Fr24Source.test.ts`

**Interfaces:**
- Consumes: `airlineName` (Task 1), `Position` с `speedKmh`/`info` (Task 3).
- Produces: тот же `fetchPositions`, но `.../live/flight-positions/full?bounds=...` и заполненные `speedKmh`, `info`.

- [ ] **Step 1: Тест**

В `src/data/Fr24Source.test.ts` заменить `sample` и первый тест, добавить два теста:
```ts
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
```
(тесты «ошибка API» и «пустой ответ» остаются как есть).

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/data/Fr24Source.test.ts`
Expected: FAIL — URL `light`, нет `speedKmh`.

- [ ] **Step 3: Реализация**

`src/data/Fr24Source.ts`: импорт `import { airlineName } from './legend';`, тип и разбор:
```ts
type RawPosition = {
  fr24_id: string; lat: number; lon: number; track: number; timestamp: string;
  gspeed?: number | null;          // узлы
  callsign?: string | null; type?: string | null; painted_as?: string | null;
  orig_iata?: string | null; dest_iata?: string | null;
};

const KMH_PER_KNOT = 1.852;
const NONE = '—';
```
URL: `live/flight-positions/full?bounds=...`.
Возврат:
```ts
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
```

- [ ] **Step 4: Тесты**

Run: `npx vitest run src/data/Fr24Source.test.ts && npm run typecheck`
Expected: PASS, 4 теста.

- [ ] **Step 5: Commit**

```bash
git add src/data/Fr24Source.ts src/data/Fr24Source.test.ts
git commit -m "feat(data): fr24 full endpoint with speed and flight legend"
```

---

### Task 6: Фото с Wikimedia Commons

**Files:**
- Create: `src/data/photos.ts`, `src/data/photos.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Photo = { url: string; author: string };
  function fetchPhotos(query: string, fetchFn?: typeof fetch): Promise<Photo[]>;          // до 2 фото, ошибки → []
  function fetchAircraftPhotos(info: FlightInfo, fetchFn?: typeof fetch): Promise<Photo[]>; // "<aircraft> <airline>", затем "<aircraft> aircraft"
  function clearPhotoCache(): void;                                                        // для тестов
  ```

- [ ] **Step 1: Тест**

`src/data/photos.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearPhotoCache, fetchAircraftPhotos, fetchPhotos } from './photos';

const page = (id: number, url: string, artist?: string) => ({
  [id]: { pageid: id, imageinfo: [{ thumburl: url, extmetadata: artist ? { Artist: { value: artist } } : {} }] },
});
const ok = (pages: object) => new Response(JSON.stringify({ query: { pages } }), { status: 200 });

describe('photos', () => {
  beforeEach(() => clearPhotoCache());

  it('берёт первые два фото и автора без тегов', async () => {
    const fetchFn = vi.fn(async () => ok({
      ...page(1, 'https://u/1.jpg', '<a href="x">Gleb Salko</a>'),
      ...page(2, 'https://u/2.jpg'),
      ...page(3, 'https://u/3.jpg', 'Third'),
    }));
    const res = await fetchPhotos('A321 Ural Airlines', fetchFn as unknown as typeof fetch);
    expect(res).toEqual([{ url: 'https://u/1.jpg', author: 'Gleb Salko' }, { url: 'https://u/2.jpg', author: '' }]);
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
    const fetchFn = vi.fn(async () => ok(page(1, 'https://u/1.jpg')));
    await fetchPhotos('same', fetchFn as unknown as typeof fetch);
    await fetchPhotos('same', fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('fetchAircraftPhotos: сначала борт и авиакомпания, при пустом ответе — только борт', async () => {
    const fetchFn = vi.fn(async (url: string) => (url.includes('Ural') ? ok({}) : ok(page(1, 'https://u/a321.jpg'))));
    const info = { callsign: 'SVR1', airline: 'Ural Airlines', aircraft: 'A321', from: { iata: 'DME', city: '' }, to: { iata: 'MCX', city: '' } };
    const res = await fetchAircraftPhotos(info, fetchFn as unknown as typeof fetch);
    expect(res).toEqual([{ url: 'https://u/a321.jpg', author: '' }]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect((fetchFn.mock.calls[1] as unknown as [string])[0]).toContain('gsrsearch=A321%20aircraft');
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/data/photos.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация**

`src/data/photos.ts`:
```ts
import type { FlightInfo } from './FlightSource';

export type Photo = { url: string; author: string };

type CommonsPage = {
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
  for (const page of Object.values(body.query?.pages ?? {})) {
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
```

- [ ] **Step 4: Тесты**

Run: `npx vitest run src/data/photos.test.ts && npm run typecheck`
Expected: PASS, 4 теста.

- [ ] **Step 5: Commit**

```bash
git add src/data/photos.ts src/data/photos.test.ts
git commit -m "feat(data): aircraft photos from wikimedia commons"
```

---

### Task 7: `flightStats`

**Files:**
- Create: `src/detect/flightStats.ts`, `src/detect/flightStats.test.ts`

**Interfaces:**
- Consumes: `Analysis`, `Letter`, `Word`, `Grade`, `LetterKind`.
- Produces:
  ```ts
  type FlightStats = { letters: { kind: LetterKind; score: number }[]; words: { text: string; score: number; grade: Grade }[]; score: number };
  function flightStats(analysis: Analysis | null, trackId: string): FlightStats;
  ```

- [ ] **Step 1: Тест**

`src/detect/flightStats.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { flightStats } from './flightStats';
import { seg } from './testUtils';
import { makeProjection } from '../geometry/project';
import type { Analysis } from './analyze';
import type { Letter, Word } from './types';

const x: Letter = { kind: 'X', score: 87, center: { x: 0, y: 0 }, up: null, size: 1000, key: 'x',
  segments: [seg(-500, -500, 500, 500, 'mock-1'), seg(-500, 500, 500, -500, 'mock-2')] };
const u: Letter = { kind: 'U', score: 70, center: { x: 1300, y: 0 }, up: { x: 0, y: 1 }, size: 1000, key: 'u',
  segments: [seg(1000, -500, 1600, 500, 'mock-3'), seg(1000, 500, 1300, 0, 'mock-4')] };
const i: Letter = { kind: 'I', score: 95, center: { x: 2600, y: 0 }, up: { x: 0, y: 1 }, size: 1000, key: 'i',
  segments: [seg(2200, -500, 2200, 500, 'mock-5'), seg(3000, -500, 3000, 500, 'mock-6'), seg(2200, -500, 3000, 500, 'mock-7')] };
const word: Word = { letters: [x, u, i], text: 'ХУЙ', correctOrder: true, score: 78, grade: 'good', center: { x: 1300, y: 0 }, key: 'x|u|i' };
const analysis: Analysis = { projection: makeProjection({ lat: 55, lon: 37 }), segmentCount: 7, letters: [x, u, i], words: [word] };

describe('flightStats', () => {
  it('борт из буквы и слова: обе записи и хуёвость по слову', () => {
    const s = flightStats(analysis, 'mock-1');
    expect(s.letters).toEqual([{ kind: 'X', score: 87 }]);
    expect(s.words).toEqual([{ text: 'ХУЙ', score: 78, grade: 'good' }]);
    expect(s.score).toBe(78);
  });

  it('буква без слова: хуёвость по букве', () => {
    const lone: Analysis = { ...analysis, words: [] };
    expect(flightStats(lone, 'mock-5')).toEqual({ letters: [{ kind: 'I', score: 95 }], words: [], score: 95 });
  });

  it('чужой борт или нет анализа — пусто', () => {
    expect(flightStats(analysis, 'mock-99')).toEqual({ letters: [], words: [], score: 0 });
    expect(flightStats(null, 'mock-1')).toEqual({ letters: [], words: [], score: 0 });
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/detect/flightStats.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация**

`src/detect/flightStats.ts`:
```ts
import type { Analysis } from './analyze';
import type { Grade, LetterKind } from './types';

/** Что нарисовал один борт: его буквы, слова с этими буквами и итоговая «хуёвость». */
export type FlightStats = {
  letters: { kind: LetterKind; score: number }[];
  words: { text: string; score: number; grade: Grade }[];
  score: number; // 0–100: лучшее слово, иначе лучшая буква, иначе 0
};

export function flightStats(analysis: Analysis | null, trackId: string): FlightStats {
  if (!analysis) return { letters: [], words: [], score: 0 };
  const mine = analysis.letters.filter((l) => l.segments.some((s) => s.trackId === trackId));
  const keys = new Set(mine.map((l) => l.key));
  const letters = [...mine]
    .sort((a, b) => b.score - a.score)
    .map((l) => ({ kind: l.kind, score: l.score }));
  const words = analysis.words
    .filter((w) => w.letters.some((l) => keys.has(l.key)))
    .sort((a, b) => b.score - a.score)
    .map((w) => ({ text: w.text, score: w.score, grade: w.grade }));
  return { letters, words, score: words[0]?.score ?? letters[0]?.score ?? 0 };
}
```

- [ ] **Step 4: Тесты**

Run: `npx vitest run src/detect/flightStats.test.ts && npm run typecheck`
Expected: PASS, 3 теста.

- [ ] **Step 5: Commit**

```bash
git add src/detect/flightStats.ts src/detect/flightStats.test.ts
git commit -m "feat(detect): per-flight stats"
```

---

### Task 8: Карта — zoom 8, плавное движение, выбор самолёта

**Files:**
- Modify: `src/map/geojson.ts`, `src/map/geojson.test.ts`, `src/map/MapView.vue`

**Interfaces:**
- Consumes: `pointAhead` (Task 2), `Track.speedKmh` (Task 3).
- Produces:
  ```ts
  type PlaneMarker = { id: string; lat: number; lon: number; heading: number; selected: boolean };
  function planesToGeoJson(planes: PlaneMarker[]): FeatureCollection; // Point, properties { id, heading, selected }
  // MapView: props { analysis, tracks, selectedId: string | null }; emits { bounds, select: [id: string | null] }
  ```

- [ ] **Step 1: Тест geojson**

В `src/map/geojson.test.ts` заменить тест «самолёты — точка в конце трека с курсом» на:
```ts
  it('самолёты — точка с курсом и флагом выбора', () => {
    const fc = planesToGeoJson([
      { id: 'a', lat: 56, lon: 38, heading: 45, selected: true },
      { id: 'b', lat: 50, lon: 30, heading: 270, selected: false },
    ]);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].geometry).toEqual({ type: 'Point', coordinates: [38, 56] });
    expect(fc.features[0].properties).toEqual({ id: 'a', heading: 45, selected: true });
    expect(fc.features[1].properties).toEqual({ id: 'b', heading: 270, selected: false });
  });
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/map/geojson.test.ts`
Expected: FAIL — свойства не совпадают.

- [ ] **Step 3: geojson.ts**

Заменить `planesToGeoJson` в `src/map/geojson.ts`:
```ts
export type PlaneMarker = { id: string; lat: number; lon: number; heading: number; selected: boolean };

/** Самолёты: точка с курсом (для поворота иконки) и флагом выбора (для цвета). */
export function planesToGeoJson(planes: PlaneMarker[]): FeatureCollection {
  return fc(planes.map((p) => point([p.lon, p.lat], { id: p.id, heading: p.heading, selected: p.selected })));
}
```
(`Track` в импортах остаётся: его использует `tracksToGeoJson`.)

- [ ] **Step 4: Тест проходит**

Run: `npx vitest run src/map/geojson.test.ts`
Expected: PASS.

- [ ] **Step 5: MapView.vue**

Заменить `<script setup>` в `src/map/MapView.vue` целиком:
```ts
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Map as MapLibreMap, NavigationControl, setWorkerUrl, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl';
// Worker MapLibre 6 грузится отдельным модулем; без явного адреса Vite его не отдаёт, тайлы не разбираются и 'load' не приходит.
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection } from 'geojson';
import type { Bounds } from '../data/FlightSource';
import type { Track } from '../tracks/TrackStore';
import type { Analysis } from '../detect/analyze';
import { pointAhead } from '../geometry/project';
import { lettersToGeoJson, planesToGeoJson, tracksToGeoJson, wordsToGeoJson, type PlaneMarker } from './geojson';

const props = defineProps<{ analysis: Analysis | null; tracks: Track[]; selectedId: string | null }>();
const emit = defineEmits<{ bounds: [b: Bounds]; select: [id: string | null] }>();

const container = ref<HTMLDivElement | null>(null);
let map: MapLibreMap | null = null;
let ready = false;
let blinkTimer: ReturnType<typeof setInterval> | null = null;
let planesTimer: ReturnType<typeof setInterval> | null = null;

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const SOURCES = ['tracks', 'planes', 'letter-strokes', 'letter-labels', 'word-outlines', 'word-labels'] as const;
// Шрифт, который отдаёт сервер стилей; без него MapLibre рисует каждый глиф локально и сыплет предупреждениями.
const TEXT_FONT = ['Noto Sans Regular'];
const PLANE_ICON_PX = 48;
const PLANE_COLOR = '#ffd600';
const PLANE_SELECTED_COLOR = '#ff5252';
const PLANES_TICK_MS = 100;        // как часто сдвигаем иконки между опросами
const MAX_EXTRAPOLATION_MS = 60_000; // борт без обновлений дальше не летит
const INITIAL_CENTER: [number, number] = [37.6, 55.7];
const INITIAL_ZOOM = 8;

const LETTER_COLOR = ['match', ['get', 'kind'], 'X', '#ff5252', 'U', '#ffb300', 'I', '#40c4ff', 'breve', '#40c4ff', '#ffffff'];
const GRADE_COLOR = ['match', ['get', 'grade'], 'perfect', '#ff1744', 'good', '#ff9100', 'crooked', '#b39ddb', '#9e9e9e'];

/** Силуэт самолёта носом на север. Рисуется на canvas, чтобы не грузить файл. */
function makePlaneIcon(px: number, fill: string): ImageData {
  const c = document.createElement('canvas');
  c.width = px; c.height = px;
  const g = c.getContext('2d')!;
  g.scale(px / 24, px / 24);
  g.translate(12, 12);
  g.fillStyle = fill;
  g.strokeStyle = '#3a3000';
  g.lineWidth = 0.8;
  g.beginPath();
  // фюзеляж, крылья, хвост — в координатах 24x24, нос вверх
  g.moveTo(0, -11); g.lineTo(1.6, -8); g.lineTo(1.6, -3);
  g.lineTo(11, 2); g.lineTo(11, 4); g.lineTo(1.6, 1.5);
  g.lineTo(1.6, 7); g.lineTo(4.5, 9.5); g.lineTo(4.5, 11); g.lineTo(0, 9.5);
  g.lineTo(-4.5, 11); g.lineTo(-4.5, 9.5); g.lineTo(-1.6, 7);
  g.lineTo(-1.6, 1.5); g.lineTo(-11, 4); g.lineTo(-11, 2); g.lineTo(-1.6, -3);
  g.lineTo(-1.6, -8); g.closePath();
  g.fill(); g.stroke();
  return g.getImageData(0, 0, px, px);
}

function currentBounds(): Bounds {
  const b = map!.getBounds();
  return { north: b.getNorth(), south: b.getSouth(), west: b.getWest(), east: b.getEast() };
}

function setData(id: (typeof SOURCES)[number], data: FeatureCollection): void {
  const src = map?.getSource(id) as GeoJSONSource | undefined;
  src?.setData(data);
}

/** Иконки между опросами ползут по курсу от последней точки; не дольше MAX_EXTRAPOLATION_MS. */
function planeMarkers(): PlaneMarker[] {
  const now = Date.now();
  return props.tracks
    .filter((t) => t.points.length >= 1)
    .map((t) => {
      const last = t.points[t.points.length - 1];
      const hours = Math.min(Math.max(now - t.lastSeen, 0), MAX_EXTRAPOLATION_MS) / 3_600_000;
      const p = pointAhead(last, t.heading, t.speedKmh * hours);
      return { id: t.id, lat: p.lat, lon: p.lon, heading: t.heading, selected: t.id === props.selectedId };
    });
}

function renderPlanes(): void {
  if (!map || !ready) return;
  setData('planes', planesToGeoJson(planeMarkers()));
}

function render(): void {
  if (!map || !ready) return;
  setData('tracks', tracksToGeoJson(props.tracks));
  renderPlanes();
  const a = props.analysis;
  if (!a) {
    setData('letter-strokes', EMPTY); setData('letter-labels', EMPTY);
    setData('word-outlines', EMPTY); setData('word-labels', EMPTY);
    return;
  }
  const letters = lettersToGeoJson(a.letters, a.projection);
  const words = wordsToGeoJson(a.words, a.projection);
  setData('letter-strokes', letters.strokes);
  setData('letter-labels', letters.labels);
  setData('word-outlines', words.outlines);
  setData('word-labels', words.labels);
}

function addLayers(m: MapLibreMap): void {
  for (const id of SOURCES) m.addSource(id, { type: 'geojson', data: EMPTY });

  m.addLayer({ id: 'tracks', type: 'line', source: 'tracks',
    paint: { 'line-color': '#7a7a7a', 'line-width': 1, 'line-opacity': 0.7 } });

  m.addLayer({ id: 'letter-strokes', type: 'line', source: 'letter-strokes',
    paint: { 'line-color': LETTER_COLOR as never, 'line-width': 3 } });

  m.addLayer({ id: 'letter-labels', type: 'symbol', source: 'letter-labels',
    layout: { 'text-field': ['get', 'label'], 'text-font': TEXT_FONT, 'text-size': 12, 'text-offset': [0, -1.2] },
    paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1 } });

  // Слова: обычные, анаграммы пунктиром, эталонные мигают.
  m.addLayer({ id: 'word-outlines', type: 'line', source: 'word-outlines',
    filter: ['all', ['!=', ['get', 'grade'], 'anagram'], ['!=', ['get', 'grade'], 'perfect']],
    paint: { 'line-color': GRADE_COLOR as never, 'line-width': ['match', ['get', 'grade'], 'good', 3, 1.5] as never } });
  m.addLayer({ id: 'word-outlines-anagram', type: 'line', source: 'word-outlines',
    filter: ['==', ['get', 'grade'], 'anagram'],
    paint: { 'line-color': '#9e9e9e', 'line-width': 1.5, 'line-dasharray': [2, 2] } });
  m.addLayer({ id: 'word-outlines-perfect', type: 'line', source: 'word-outlines',
    filter: ['==', ['get', 'grade'], 'perfect'],
    paint: { 'line-color': '#ff1744', 'line-width': 5 } });

  m.addLayer({ id: 'word-labels', type: 'symbol', source: 'word-labels',
    layout: { 'text-field': ['get', 'label'], 'text-font': TEXT_FONT, 'text-size': ['match', ['get', 'grade'], 'perfect', 28, 'good', 22, 16] as never, 'text-allow-overlap': true },
    paint: { 'text-color': GRADE_COLOR as never, 'text-halo-color': '#000000', 'text-halo-width': 2 } });

  // Самолёты — верхний слой, чтобы по ним можно было кликнуть.
  m.addImage('plane', makePlaneIcon(PLANE_ICON_PX, PLANE_COLOR), { pixelRatio: 2 });
  m.addImage('plane-selected', makePlaneIcon(PLANE_ICON_PX, PLANE_SELECTED_COLOR), { pixelRatio: 2 });
  m.addLayer({ id: 'planes', type: 'symbol', source: 'planes',
    layout: {
      'icon-image': ['case', ['get', 'selected'], 'plane-selected', 'plane'] as never,
      'icon-rotate': ['get', 'heading'], 'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true, 'icon-ignore-placement': true,
    } });

  m.on('click', 'planes', (e) => {
    const id = e.features?.[0]?.properties?.id as string | undefined;
    emit('select', id ?? null);
  });
  m.on('click', (e: MapMouseEvent) => {
    if (m.queryRenderedFeatures(e.point, { layers: ['planes'] }).length === 0) emit('select', null);
  });
  m.on('mouseenter', 'planes', () => { m.getCanvas().style.cursor = 'pointer'; });
  m.on('mouseleave', 'planes', () => { m.getCanvas().style.cursor = ''; });

  let on = true;
  blinkTimer = setInterval(() => {
    on = !on;
    m.setPaintProperty('word-outlines-perfect', 'line-opacity', on ? 1 : 0.2);
  }, 500);
  planesTimer = setInterval(renderPlanes, PLANES_TICK_MS);
}

onMounted(() => {
  setWorkerUrl(mapWorkerUrl);
  map = new MapLibreMap({
    container: container.value!,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: INITIAL_CENTER,
    zoom: INITIAL_ZOOM,
  });
  map.addControl(new NavigationControl(), 'top-right');
  map.on('load', () => {
    addLayers(map!);
    ready = true;
    render();
    emit('bounds', currentBounds());
  });
  map.on('moveend', () => emit('bounds', currentBounds()));
});

onBeforeUnmount(() => {
  if (blinkTimer) clearInterval(blinkTimer);
  if (planesTimer) clearInterval(planesTimer);
  map?.remove();
  map = null;
});

watch(() => [props.analysis, props.tracks], render);
watch(() => props.selectedId, renderPlanes);

defineExpose({
  flyTo(lon: number, lat: number) {
    map?.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 7) });
  },
});
```
Шаблон и стили не меняются.

- [ ] **Step 6: Typecheck и тесты**

Run: `npm run typecheck && npm test`
Сначала в `src/App.vue` добавить к `<MapView ... />` временный проп `:selected-id="null"` (Task 9 заменит его настоящим значением), иначе vue-tsc укажет на отсутствующий обязательный проп. Expected: typecheck чистый (если MapLibre ругается на тип выражения `icon-image` — оставить `as never`; если на тип обработчика `click` с двумя аргументами — убрать аннотацию `MapMouseEvent` и импорт), тесты зелёные.

- [ ] **Step 7: Commit**

```bash
git add src/map/geojson.ts src/map/geojson.test.ts src/map/MapView.vue src/App.vue
git commit -m "feat(map): zoom 8, planes glide between polls, click selects a plane"
```

---

### Task 9: `FlightCard.vue` и сборка в `App.vue`

**Files:**
- Create: `src/ui/FlightCard.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `Track`, `Photo`, `FlightStats`, `fetchAircraftPhotos`, `flightStats`, `LETTER_CHAR`, `GRADE_LABEL`, MapView `selectedId`/`select`.
- Produces: `FlightCard.vue`: `props { track: Track; photos: Photo[]; stats: FlightStats }`, `emits { close: [] }`.

- [ ] **Step 1: FlightCard.vue**

`src/ui/FlightCard.vue`:
```vue
<script setup lang="ts">
import type { Track } from '../tracks/TrackStore';
import type { Photo } from '../data/photos';
import type { FlightStats } from '../detect/flightStats';
import { GRADE_LABEL, LETTER_CHAR } from '../detect/types';

const props = defineProps<{ track: Track; photos: Photo[]; stats: FlightStats }>();
const emit = defineEmits<{ close: [] }>();

const NONE = '—';
</script>

<template>
  <section class="card">
    <header class="head">
      <div>
        <div class="callsign">
          {{ props.track.info?.callsign ?? props.track.id }}
          <span class="chip">{{ props.track.info?.aircraft ?? NONE }}</span>
        </div>
        <div class="airline">{{ props.track.info?.airline ?? 'Неизвестная авиакомпания' }}</div>
      </div>
      <button class="close" title="Закрыть" @click="emit('close')">×</button>
    </header>

    <div class="photos">
      <figure v-for="p in props.photos" :key="p.url">
        <img :src="p.url" alt="" />
        <figcaption v-if="p.author">© {{ p.author }}</figcaption>
      </figure>
      <div v-if="props.photos.length === 0" class="nophoto">фото не нашлось</div>
    </div>

    <div class="route">
      <div class="airport">
        <div class="iata">{{ props.track.info?.from.iata ?? NONE }}</div>
        <div class="city">{{ props.track.info?.from.city }}</div>
      </div>
      <div class="arrow">✈</div>
      <div class="airport">
        <div class="iata">{{ props.track.info?.to.iata ?? NONE }}</div>
        <div class="city">{{ props.track.info?.to.city }}</div>
      </div>
    </div>

    <div class="stats">
      <div class="title">Хуёвость <b>{{ props.stats.score }}%</b></div>
      <div class="bar"><div class="fill" :style="{ width: props.stats.score + '%' }" /></div>
      <ul v-if="props.stats.letters.length || props.stats.words.length">
        <li v-for="(l, i) in props.stats.letters" :key="'l' + i">Нарисовал букву {{ LETTER_CHAR[l.kind] }} на {{ l.score }}%</li>
        <li v-for="(w, i) in props.stats.words" :key="'w' + i" :class="w.grade">В составе слова {{ w.text }}, {{ GRADE_LABEL[w.grade] }}, {{ w.score }}%</li>
      </ul>
      <p v-else class="none">Ничего не нарисовал</p>
    </div>
  </section>
</template>

<style scoped>
.card {
  position: absolute; top: 12px; right: 12px; width: 340px; max-height: calc(100% - 24px); overflow: auto;
  background: rgba(20, 20, 20, 0.95); color: #eee; border-radius: 8px; display: flex; flex-direction: column;
}
.head { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px; }
.callsign { font-size: 26px; font-weight: bold; color: #ffd600; display: flex; align-items: center; gap: 8px; }
.chip { font-size: 12px; font-weight: normal; color: #fff; background: #2a5d8f; border-radius: 4px; padding: 2px 6px; }
.airline { font-size: 14px; color: #ddd; }
.close { background: none; border: none; color: #eee; font-size: 26px; line-height: 1; cursor: pointer; }
.photos { display: flex; gap: 2px; background: #000; min-height: 120px; }
.photos figure { margin: 0; flex: 1; position: relative; }
.photos img { width: 100%; height: 160px; object-fit: cover; display: block; }
.photos figcaption { position: absolute; left: 6px; bottom: 4px; font-size: 11px; color: #ddd; text-shadow: 0 0 3px #000; }
.nophoto { flex: 1; display: flex; align-items: center; justify-content: center; color: #777; font-size: 13px; }
.route { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 12px; text-align: center; }
.iata { font-size: 36px; font-weight: bold; }
.city { font-size: 13px; color: #bbb; text-transform: uppercase; }
.arrow { font-size: 24px; color: #ffd600; }
.stats { padding: 12px; border-top: 1px solid #333; font-size: 13px; }
.title { font-size: 15px; margin-bottom: 6px; }
.bar { height: 8px; background: #333; border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
.fill { height: 100%; background: #ffd600; }
ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.none { color: #999; margin: 0; }
.perfect { color: #ff1744; }
.good { color: #ff9100; }
.crooked { color: #b39ddb; }
.anagram { color: #9e9e9e; }
</style>
```

- [ ] **Step 2: App.vue**

В `<script setup>` `src/App.vue` добавить импорты:
```ts
import FlightCard from './ui/FlightCard.vue';
import { fetchAircraftPhotos, type Photo } from './data/photos';
import { flightStats } from './detect/flightStats';
```
и после `const letters = computed(...)`:
```ts
// Выбранный самолёт: карточка, фото, статистика.
const selectedId = ref<string | null>(null);
const selectedTrack = computed(() => scanner.tracks.value.find((t) => t.id === selectedId.value) ?? null);
const photos = ref<Photo[]>([]);
const stats = computed(() => flightStats(scanner.analysis.value, selectedId.value ?? ''));

watch(selectedId, async (id) => {
  photos.value = [];
  const info = id ? scanner.tracks.value.find((t) => t.id === id)?.info : null;
  if (!info) return;
  const found = await fetchAircraftPhotos(info);
  if (selectedId.value === id) photos.value = found;
});

// Борт исчез из хранилища — карточка закрывается.
watch(selectedTrack, (t) => {
  if (!t && selectedId.value !== null) selectedId.value = null;
});
```
В шаблоне заменить строку `<MapView ... />` на:
```vue
    <MapView
      ref="mapView"
      :analysis="scanner.analysis.value"
      :tracks="scanner.tracks.value"
      :selected-id="selectedId"
      @bounds="onBounds"
      @select="selectedId = $event"
    />
```
и после `</aside>` добавить:
```vue
    <FlightCard v-if="selectedTrack" :track="selectedTrack" :photos="photos" :stats="stats" @close="selectedId = null" />
```

- [ ] **Step 3: Типы, тесты, сборка**

Run: `npm run typecheck && npm test && npm run build`
Expected: всё зелёное.

- [ ] **Step 4: Ручная проверка в браузере**

Run: `npm run dev` и открыть адрес.
1. Карта открывается на zoom 8 вокруг Москвы, в кадре десятки жёлтых самолётов, они плавно ползут по курсу, а не прыгают раз в 5 секунд.
2. Отдалить карту на два шага — рейсов становится больше (до 120); приблизить — меньше (не меньше 30).
3. Курсор над самолётом — рука. Клик: самолёт краснеет, справа карточка: позывной вида SVR1343, чип с типом борта, авиакомпания, два фото с автором (или «фото не нашлось»), IATA вылета и прилёта с городами, блок «Хуёвость 0%», «Ничего не нарисовал».
4. Нажать «Слово», через 2–3 минуты кликнуть по красному штриху Х: в карточке «Нарисовал букву Х на NN%» и «В составе слова ХУЙ, …».
5. Крестик и клик по пустой карте закрывают карточку. Клик по другому самолёту переключает.
6. Подсаженный борт долетел и исчез — карточка закрылась сама.
7. В консоли нет ошибок и предупреждений про шрифты.

- [ ] **Step 5: Commit**

```bash
git add src/ui/FlightCard.vue src/App.vue
git commit -m "feat: flight card with legend, photos and per-flight stats"
```

---

## Порядок и зависимости

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Задачи 4–7 зависят только от 1–3 и друг от друга не зависят, но выполняются последовательно в одном рабочем дереве.

## Что не покрыто планом намеренно

- Реальный ответ FR24 `full` не проверен живьём (нет ключа), поля по документации.
- Фото зависят от Wikimedia; при отсутствии сети карточка без фото.
- Оформление левой панели, история находок, избранное — вне объёма.
