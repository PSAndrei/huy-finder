# Huy Finder — карточка рейса, живые самолёты, зум

Дата: 2026-09-19. Вторая итерация поверх ветки `huy-finder` (первая спека:
`2026-09-19-huy-finder-design.md`, она остаётся в силе там, где эта её не меняет).

## 1. Цели

- Самолёты выглядят живыми: стартовый масштаб zoom 8, плотность бортов от площади области,
  иконки плавно ползут по курсу между опросами.
- Клик по самолёту открывает карточку рейса в духе Flightradar24: позывной, тип борта,
  авиакомпания, пара фото, аэропорты вылета и прилёта, и блок «хуёвости» — что этот борт
  нарисовал.
- В демо-режиме легенда рейса выдуманная, но правдоподобная. В API-режиме те же поля берутся
  из FR24 `live/flight-positions/full`.

Вне объёма: история находок, избранное, интерполяция поворотов, расписание и время рейса,
оформление панели слева.

## 2. Типы

```ts
type Airport = { iata: string; city: string };
type FlightInfo = {
  callsign: string;      // 'SVR1343'
  airline: string;       // 'Ural Airlines'
  aircraft: string;      // 'A321'
  from: Airport;
  to: Airport;
};
type Position = {
  id: string; lat: number; lon: number; heading: number; timestamp: number;
  speedKmh: number;              // новое
  info?: FlightInfo;             // новое; у FR24 light и в тестах может отсутствовать
};
type Track = {
  id: string; points: LatLon[]; lastSeen: number; heading: number;
  speedKmh: number;              // новое, из последней позиции
  info: FlightInfo | null;       // новое, последняя непустая
};
type Photo = { url: string; author: string };
type FlightStats = {
  letters: { kind: LetterKind; score: number }[];               // буквы с отрезками этого трека
  words: { text: string; score: number; grade: Grade }[];        // слова из этих букв
  score: number;                                                 // 0–100, «хуёвость»
};
```

## 3. Структура

```
src/
  data/
    FlightSource.ts   + Airport, FlightInfo, поля Position
    legend.ts         НОВОЕ: списки авиакомпаний, бортов, аэропортов; makeFlightInfo(rng)
    MockSource.ts     легенда рейсов, скорость в Position, плотность от площади, пересоздание при смене масштаба
    Fr24Source.ts     endpoint full, разбор новых полей
    photos.ts         НОВОЕ: fetchPhotos(query) через Wikimedia Commons, кэш
  tracks/
    TrackStore.ts     speedKmh, info
  geometry/
    project.ts        + pointAhead(p, headingDeg, km)
  detect/
    flightStats.ts    НОВОЕ: flightStats(analysis, trackId)
  map/
    geojson.ts        planesToGeoJson принимает позиции с уже сдвинутыми точками и флагом selected
    MapView.vue       zoom 8, плавное движение, клик по самолёту, выделение
  ui/
    FlightCard.vue    НОВОЕ
  App.vue            выбранный рейс, фото, статистика, карточка
```

## 4. Легенда рейса (`legend.ts`)

Три списка, все значения реальные:

```ts
const AIRLINES: { name: string; prefix: string }[] = [
  { name: 'Aeroflot', prefix: 'AFL' }, { name: 'S7 Airlines', prefix: 'SBI' },
  { name: 'Ural Airlines', prefix: 'SVR' }, { name: 'Pobeda', prefix: 'PBD' },
  { name: 'UTair', prefix: 'UTA' }, { name: 'Rossiya', prefix: 'SDM' },
  { name: 'Nordwind', prefix: 'NWS' }, { name: 'Azur Air', prefix: 'AZV' },
  { name: 'Turkish Airlines', prefix: 'THY' }, { name: 'Emirates', prefix: 'UAE' },
  { name: 'Belavia', prefix: 'BRU' }, { name: 'Air Astana', prefix: 'KZR' },
];
const AIRCRAFT = ['A320', 'A321', 'A319', 'B737', 'B738', 'B77W', 'A350', 'SU95'];
const AIRPORTS: Airport[] = [
  { iata: 'SVO', city: 'Moscow' }, { iata: 'DME', city: 'Moscow' }, { iata: 'VKO', city: 'Moscow' },
  { iata: 'LED', city: 'Saint Petersburg' }, { iata: 'KZN', city: 'Kazan' }, { iata: 'SVX', city: 'Yekaterinburg' },
  { iata: 'AER', city: 'Sochi' }, { iata: 'KRR', city: 'Krasnodar' }, { iata: 'MCX', city: 'Makhachkala' },
  { iata: 'UFA', city: 'Ufa' }, { iata: 'KUF', city: 'Samara' }, { iata: 'ROV', city: 'Rostov-on-Don' },
  { iata: 'GOJ', city: 'Nizhny Novgorod' }, { iata: 'OVB', city: 'Novosibirsk' }, { iata: 'MRV', city: 'Mineralnye Vody' },
  { iata: 'IST', city: 'Istanbul' }, { iata: 'DXB', city: 'Dubai' }, { iata: 'MSQ', city: 'Minsk' },
  { iata: 'ALA', city: 'Almaty' }, { iata: 'TAS', city: 'Tashkent' },
];
```

`makeFlightInfo(rng: () => number): FlightInfo` — авиакомпания, борт и два разных аэропорта
случайно через `rng`; позывной — `prefix` + число 100–9999. Одно зерно — одна легенда.

`airlineName(prefix: string): string` — имя по позывному-префиксу из `AIRLINES`, иначе сам
префикс. Нужна адаптеру FR24.

## 5. Генератор

- `Flight` получает `info: FlightInfo`, заполняется в `randomFlight`, `edgeFlight` и
  `plantStrokes` через `makeFlightInfo(this.rng)`.
- `fetchPositions` отдаёт `speedKmh: f.speedKmh` и `info: f.info`.
- Число рейсов при создании: `clamp(round(areaKm2 / 600), 30, 120)`, где
  `areaKm2 = (north − south) × 111.32 × (east − west) × 111.32 × cos(средняя широта)`.
  Параметр `count` конструктора остаётся как верхняя граница для тестов: если передан явно,
  берётся `min(count, плотность)`; по умолчанию `count = 120`.
- Пересоздание рейсов: как сейчас при сдвиге центра больше половины размера, и дополнительно
  когда высота области изменилась больше чем вдвое в любую сторону.

## 6. Адаптер FR24

- Endpoint `live/flight-positions/full?bounds=N,S,W,E`.
- Поля ответа (по документации FR24, живьём не проверено): `fr24_id, callsign, lat, lon, track,
  gspeed` (узлы), `timestamp` (ISO), `type`, `painted_as` (ICAO авиакомпании), `orig_iata`,
  `dest_iata`.
- `speedKmh = gspeed × 1.852`. `info` собирается, если есть `callsign`; `airline =
  airlineName(painted_as ?? callsign.slice(0, 3))`, `aircraft = type ?? '—'`, аэропорты
  `{ iata: orig_iata ?? '—', city: '' }`.

## 7. Фото (`photos.ts`)

```ts
function fetchPhotos(query: string, fetchFn = fetch): Promise<Photo[]>;
```

- URL: `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=4&gsrsearch=<query>&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640`.
- Из `query.pages` берём первые две страницы с `imageinfo[0].thumburl`; `author` из
  `extmetadata.Artist.value` с вырезанными тегами, иначе пусто.
- Ошибка сети, не-2xx, нет страниц → `[]`. Кэш `Map<string, Promise<Photo[]>>` на модуль.
- Запрос: `${aircraft} ${airline}`; если пусто — повтор с `${aircraft} aircraft`.

## 8. Плавное движение

- `pointAhead(p: LatLon, headingDeg: number, km: number): LatLon` в `geometry/project.ts`:
  та же формула, что `moveKm` в генераторе (широта + km·cos/111.32, долгота + km·sin/(111.32·cos φ)).
  `MockSource.moveKm` переводится на неё.
- `MapView` раз в 100 мс (таймер, не rAF: при скрытой вкладке не крутится) пересчитывает точки
  самолётов: `pointAhead(последняя точка, heading, speedKmh × (Date.now() − lastSeen) / 3 600 000)`
  и кладёт в источник `planes`. Прошедшее время ограничено 60 с, чтобы борт без обновлений не
  улетал бесконечно.
- `planesToGeoJson(planes: { id: string; lat: number; lon: number; heading: number; selected: boolean }[])`.
  Треки и детекторы работают по-прежнему по сырым точкам.

## 9. Клик и карточка

- Слой `planes`: `map.on('click', 'planes')` → `emit('select', id)`; клик по карте мимо самолётов
  → `emit('select', null)`. Курсор над самолётом — `pointer`.
- Два изображения иконки: `plane` жёлтая и `plane-selected` красная (`#ff5252`); слой выбирает
  по свойству `selected`.
- `App.vue`: `selectedId: Ref<string | null>`; при выборе — `fetchPhotos` по легенде трека,
  `flightStats(analysis, id)` пересчитывается при каждом новом анализе (computed). Если трек
  выбранного борта исчез из хранилища, карточка закрывается.
- `FlightCard.vue`, props `{ track: Track; photos: Photo[]; stats: FlightStats }`, emits `close`.
  Раскладка сверху вниз: позывной крупно жёлтым, чип с типом борта, название авиакомпании,
  крестик; полоса с двумя фото (или серая заглушка с текстом «фото не нашлось»), под фото
  автор; две колонки IATA крупно + город, между ними иконка самолёта; блок «Хуёвость»:
  процент и полоска, строки «Нарисовал букву Х на 87%» по каждой букве, «В составе слова ХУЙ,
  Годный, 78%» по каждому слову, если ничего — «Ничего не нарисовал». Положение: справа сверху,
  ширина 340px, поверх карты, тёмная как левая панель.

## 10. Статистика хуёвости (`detect/flightStats.ts`)

```ts
function flightStats(analysis: Analysis | null, trackId: string): FlightStats;
```

- `letters` — буквы из `analysis.letters`, у которых хотя бы один `segments[].trackId === trackId`,
  по убыванию `score`.
- `words` — слова из `analysis.words`, у которых хотя бы одна буква входит в `letters`
  (сравнение по `key`), по убыванию `score`.
- `score` — `words[0]?.score ?? letters[0]?.score ?? 0`.
- `analysis === null` → всё пусто, `score 0`.

## 11. Тесты (Vitest)

- `legend`: одно зерно — одна легенда; аэропорты вылета и прилёта разные; `airlineName`.
- `MockSource`: у позиций есть `speedKmh` и `info`; плотность: область 350×230 км даёт около
  115 рейсов, область 100×60 км даёт 30, область 2000×1500 км даёт 120; изменение высоты вдвое
  пересоздаёт рейсы.
- `Fr24Source`: разбор `full` — `speedKmh`, `info`, отсутствие `type`/аэропортов не ломает.
- `photos`: подменённый `fetch` с двумя страницами → два фото с авторами; ошибка → `[]`;
  повторный вызов не делает второй запрос.
- `pointAhead`: 111.32 км на север даёт +1° широты; на восток на экваторе +1° долготы.
- `flightStats`: буква с отрезком трека находится; слово с этой буквой находится; чужой трек →
  пусто, `score 0`.
- `TrackStore`: хранит `speedKmh` и `info` последней позиции.
- Компоненты — ручная проверка и прогон в headless Chrome.
