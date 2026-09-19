# Huy Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Одностраничное приложение на карте, которое из треков самолётов находит буквы Х, У, И (показываем как Й) и слово ХУЙ со шкалой идеальности.

**Architecture:** Чистые модули `geometry/` и `detect/` без Vue считают буквы по отрезкам упрощённых треков. `useScanner` крутит цикл: источник позиций → `TrackStore` → `analyze` → реактивный результат. Карта на MapLibre и панели только рисуют результат. Источник по умолчанию — генератор `MockSource` с подсадкой букв, адаптер `Fr24Source` — тонкий и не проверяется на живых данных.

**Tech Stack:** Vite, Vue 3 (script setup, TypeScript), MapLibre GL, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-huy-finder-design.md`

## Global Constraints

- Язык интерфейса и комментариев — русский. Имена в коде — английские.
- Все расчёты детекторов в плоских метрах локальной проекции (центр — центр видимой области).
- Два отрезка одного трека не могут входить в одну букву.
- Порог показа буквы 30%. Ползунок чувствительности `sensitivity ∈ [-1, 1]` меняет допуски детекторов на ±30%, допуск упрощения (2 км) не трогает.
- Тесты — Vitest, файлы `*.test.ts` рядом с кодом. Компоненты Vue тестами не покрываем.
- Коммит после каждой задачи. Ключ API не коммитим: только `.env.example`.
- Модули `geometry/`, `detect/`, `tracks/`, `data/` не импортируют Vue и MapLibre.

---

### Task 1: Каркас проекта

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.env.example`
- Create: `src/main.ts`, `src/App.vue`, `src/vite-env.d.ts`, `src/smoke.test.ts`

**Interfaces:**
- Produces: команды `npm run dev`, `npm run build`, `npm test`, `npm run typecheck`.

- [ ] **Step 1: Создать package.json и конфиги**

`package.json`:
```json
{
  "name": "huy-finder",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "vue-tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

`index.html`:
```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Huy Finder</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`.gitignore`:
```
node_modules
dist
.env
.env.local
```

`.env.example`:
```
# Ключ Flightradar24 API. Без него доступен только демо-режим.
VITE_FR24_KEY=
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
```

`src/main.ts`:
```ts
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
```

`src/App.vue` (заглушка, заменится в Task 16):
```vue
<script setup lang="ts">
</script>

<template>
  <main>Huy Finder</main>
</template>
```

- [ ] **Step 2: Установить зависимости**

Run:
```bash
cd /Users/user/Desktop/vibe-proj
npm install vue maplibre-gl
npm install -D vite @vitejs/plugin-vue typescript vue-tsc vitest @types/geojson
```
Expected: `node_modules` создан, в `package.json` появились `dependencies` и `devDependencies`.

- [ ] **Step 3: Дымовой тест**

`src/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('vitest работает', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Проверить тесты, типы и сборку**

Run: `npm test && npm run build`
Expected: 1 тест прошёл, `dist/` собран без ошибок.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + vue + vitest"
```

---

### Task 2: geometry/project — локальная проекция

**Files:**
- Create: `src/geometry/project.ts`, `src/geometry/project.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type LatLon = { lat: number; lon: number };
  type Pt = { x: number; y: number };
  type Projection = { center: LatLon; toXY(p: LatLon): Pt; toLatLon(p: Pt): LatLon };
  function makeProjection(center: LatLon): Projection;
  ```

- [ ] **Step 1: Тест**

`src/geometry/project.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeProjection } from './project';

describe('makeProjection', () => {
  const proj = makeProjection({ lat: 55, lon: 37 });

  it('центр проецируется в ноль', () => {
    expect(proj.toXY({ lat: 55, lon: 37 })).toEqual({ x: 0, y: 0 });
  });

  it('один градус широты — около 111 км на север', () => {
    const p = proj.toXY({ lat: 56, lon: 37 });
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y / 1000).toBeCloseTo(111.2, 0);
  });

  it('на широте 55 градус долготы короче градуса широты', () => {
    const p = proj.toXY({ lat: 55, lon: 38 });
    expect(p.x).toBeGreaterThan(60_000);
    expect(p.x).toBeLessThan(65_000);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('туда и обратно', () => {
    const src = { lat: 55.7, lon: 37.6 };
    const back = proj.toLatLon(proj.toXY(src));
    expect(back.lat).toBeCloseTo(src.lat, 9);
    expect(back.lon).toBeCloseTo(src.lon, 9);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/geometry/project.test.ts`
Expected: FAIL, модуль `./project` не найден.

- [ ] **Step 3: Реализация**

`src/geometry/project.ts`:
```ts
export type LatLon = { lat: number; lon: number };
export type Pt = { x: number; y: number };

export type Projection = {
  center: LatLon;
  toXY(p: LatLon): Pt;
  toLatLon(p: Pt): LatLon;
};

const EARTH_RADIUS_M = 6_371_000;
export const DEG = Math.PI / 180;

/** Равнопромежуточная проекция вокруг центра: метры на восток (x) и на север (y). */
export function makeProjection(center: LatLon): Projection {
  const cosLat = Math.cos(center.lat * DEG);
  return {
    center,
    toXY(p) {
      return {
        x: (p.lon - center.lon) * DEG * EARTH_RADIUS_M * cosLat,
        y: (p.lat - center.lat) * DEG * EARTH_RADIUS_M,
      };
    },
    toLatLon(p) {
      return {
        lat: center.lat + p.y / EARTH_RADIUS_M / DEG,
        lon: center.lon + p.x / (EARTH_RADIUS_M * cosLat) / DEG,
      };
    },
  };
}
```

- [ ] **Step 4: Тест проходит**

Run: `npx vitest run src/geometry/project.test.ts`
Expected: PASS, 4 теста.

- [ ] **Step 5: Commit**

```bash
git add src/geometry
git commit -m "feat(geometry): local equirectangular projection"
```

---

### Task 3: geometry/segments — операции с отрезками

**Files:**
- Create: `src/geometry/segments.ts`, `src/geometry/segments.test.ts`

**Interfaces:**
- Consumes: `Pt` из Task 2.
- Produces:
  ```ts
  type Segment = { id: string; trackId: string; a: Pt; b: Pt };
  function distance(p: Pt, q: Pt): number;
  function length(s: Segment): number;
  function midpoint(s: Segment): Pt;
  function sub(p: Pt, q: Pt): Pt; function add(p: Pt, q: Pt): Pt; function scale(p: Pt, k: number): Pt;
  function dot(p: Pt, q: Pt): number; function norm(p: Pt): Pt; function neg(p: Pt): Pt;
  function direction(s: Segment): Pt;           // единичный вектор от a к b
  function angleDeg(u: Pt, v: Pt): number;      // 0–180 между векторами
  function lineAngle(s1: Segment, s2: Segment): number; // острый угол между прямыми, 0–90
  function intersect(s1: Segment, s2: Segment): { point: Pt; t1: number; t2: number } | null;
  function projectPoint(p: Pt, s: Segment): { t: number; dist: number }; // t не ограничен, dist до отрезка
  ```

- [ ] **Step 1: Тест**

`src/geometry/segments.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  type Segment, length, lineAngle, intersect, projectPoint, direction, angleDeg, midpoint,
} from './segments';

function seg(ax: number, ay: number, bx: number, by: number, trackId = 't'): Segment {
  return { id: `${trackId}#${ax},${ay}`, trackId, a: { x: ax, y: ay }, b: { x: bx, y: by } };
}

describe('segments', () => {
  it('длина и середина', () => {
    const s = seg(0, 0, 3, 4);
    expect(length(s)).toBe(5);
    expect(midpoint(s)).toEqual({ x: 1.5, y: 2 });
  });

  it('направление единичное', () => {
    const d = direction(seg(0, 0, 0, 5));
    expect(d.x).toBeCloseTo(0);
    expect(d.y).toBeCloseTo(1);
  });

  it('угол между векторами', () => {
    expect(angleDeg({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
    expect(angleDeg({ x: 1, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(180);
  });

  it('острый угол между прямыми не зависит от направления', () => {
    expect(lineAngle(seg(0, 0, 1, 0), seg(0, 0, 0, 1))).toBeCloseTo(90);
    expect(lineAngle(seg(0, 0, 1, 0), seg(5, 0, 0, 0))).toBeCloseTo(0);
    expect(lineAngle(seg(0, 0, 1, 1), seg(0, 0, -1, 0))).toBeCloseTo(45);
  });

  it('пересечение крестом в середине', () => {
    const hit = intersect(seg(-1, -1, 1, 1), seg(-1, 1, 1, -1));
    expect(hit).not.toBeNull();
    expect(hit!.point.x).toBeCloseTo(0);
    expect(hit!.point.y).toBeCloseTo(0);
    expect(hit!.t1).toBeCloseTo(0.5);
    expect(hit!.t2).toBeCloseTo(0.5);
  });

  it('параллельные и непересекающиеся дают null', () => {
    expect(intersect(seg(0, 0, 1, 0), seg(0, 1, 1, 1))).toBeNull();
    expect(intersect(seg(0, 0, 1, 0), seg(2, -1, 2, 1))).toBeNull();
  });

  it('проекция точки на отрезок', () => {
    const s = seg(0, 0, 10, 0);
    expect(projectPoint({ x: 3, y: 2 }, s)).toEqual({ t: 0.3, dist: 2 });
    const beyond = projectPoint({ x: 13, y: 4 }, s);
    expect(beyond.t).toBeCloseTo(1.3);
    expect(beyond.dist).toBeCloseTo(5);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/geometry/segments.test.ts`
Expected: FAIL, модуль не найден.

- [ ] **Step 3: Реализация**

`src/geometry/segments.ts`:
```ts
import { DEG, type Pt } from './project';

export type Segment = { id: string; trackId: string; a: Pt; b: Pt };

export function sub(p: Pt, q: Pt): Pt { return { x: p.x - q.x, y: p.y - q.y }; }
export function add(p: Pt, q: Pt): Pt { return { x: p.x + q.x, y: p.y + q.y }; }
export function scale(p: Pt, k: number): Pt { return { x: p.x * k, y: p.y * k }; }
export function neg(p: Pt): Pt { return { x: -p.x, y: -p.y }; }
export function dot(p: Pt, q: Pt): number { return p.x * q.x + p.y * q.y; }
export function distance(p: Pt, q: Pt): number { return Math.hypot(q.x - p.x, q.y - p.y); }

export function norm(p: Pt): Pt {
  const l = Math.hypot(p.x, p.y);
  return l === 0 ? { x: 0, y: 0 } : { x: p.x / l, y: p.y / l };
}

export function length(s: Segment): number { return distance(s.a, s.b); }
export function midpoint(s: Segment): Pt { return { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 }; }
export function direction(s: Segment): Pt { return norm(sub(s.b, s.a)); }

/** Угол между векторами в градусах, 0–180. */
export function angleDeg(u: Pt, v: Pt): number {
  const c = Math.max(-1, Math.min(1, dot(norm(u), norm(v))));
  return Math.acos(c) / DEG;
}

/** Острый угол между прямыми отрезков, 0–90. Направление не важно. */
export function lineAngle(s1: Segment, s2: Segment): number {
  const a = angleDeg(direction(s1), direction(s2));
  return a > 90 ? 180 - a : a;
}

/** Пересечение отрезков. t1, t2 — доля длины от a к b. null, если не пересекаются или параллельны. */
export function intersect(s1: Segment, s2: Segment): { point: Pt; t1: number; t2: number } | null {
  const r = sub(s1.b, s1.a);
  const s = sub(s2.b, s2.a);
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-12) return null;
  const qp = sub(s2.a, s1.a);
  const t1 = (qp.x * s.y - qp.y * s.x) / den;
  const t2 = (qp.x * r.y - qp.y * r.x) / den;
  if (t1 < 0 || t1 > 1 || t2 < 0 || t2 > 1) return null;
  return { point: add(s1.a, scale(r, t1)), t1, t2 };
}

/** Проекция точки на прямую отрезка. t — доля длины (может быть вне 0–1), dist — расстояние до ближайшей точки отрезка. */
export function projectPoint(p: Pt, s: Segment): { t: number; dist: number } {
  const r = sub(s.b, s.a);
  const len2 = dot(r, r);
  if (len2 === 0) return { t: 0, dist: distance(p, s.a) };
  const t = dot(sub(p, s.a), r) / len2;
  const tc = Math.max(0, Math.min(1, t));
  return { t, dist: distance(p, add(s.a, scale(r, tc))) };
}
```

- [ ] **Step 4: Тест проходит**

Run: `npx vitest run src/geometry/segments.test.ts`
Expected: PASS, 7 тестов.

- [ ] **Step 5: Commit**

```bash
git add src/geometry
git commit -m "feat(geometry): segment math"
```

---

### Task 4: geometry/simplify — Дуглас-Пекер и нарезка на отрезки

**Files:**
- Create: `src/geometry/simplify.ts`, `src/geometry/simplify.test.ts`

**Interfaces:**
- Consumes: `Pt`, `Segment`, `projectPoint`.
- Produces:
  ```ts
  function simplify(points: Pt[], toleranceM: number): Pt[];
  function toSegments(points: Pt[], trackId: string): Segment[]; // id = `${trackId}#${i}`
  ```

- [ ] **Step 1: Тест**

`src/geometry/simplify.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { simplify, toSegments } from './simplify';

describe('simplify', () => {
  it('почти прямая схлопывается в два конца', () => {
    const pts = [0, 1, 2, 3, 4, 5].map((i) => ({ x: i * 1000, y: (i % 2) * 10 }));
    expect(simplify(pts, 100)).toEqual([pts[0], pts[5]]);
  });

  it('излом сохраняется', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 2000, y: 0 },
      { x: 2000, y: 1000 }, { x: 2000, y: 2000 },
    ];
    expect(simplify(pts, 100)).toEqual([pts[0], pts[2], pts[4]]);
  });

  it('две точки и меньше не меняются', () => {
    expect(simplify([{ x: 0, y: 0 }], 10)).toEqual([{ x: 0, y: 0 }]);
    expect(simplify([], 10)).toEqual([]);
  });

  it('toSegments нумерует отрезки', () => {
    const segs = toSegments([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], 'abc');
    expect(segs.map((s) => s.id)).toEqual(['abc#0', 'abc#1']);
    expect(segs.every((s) => s.trackId === 'abc')).toBe(true);
    expect(segs[1].a).toEqual({ x: 1, y: 0 });
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/geometry/simplify.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация**

`src/geometry/simplify.ts`:
```ts
import type { Pt } from './project';
import { projectPoint, type Segment } from './segments';

/** Дуглас-Пекер: убирает точки, отклоняющиеся от хорды меньше чем на toleranceM. */
export function simplify(points: Pt[], toleranceM: number): Pt[] {
  if (points.length <= 2) return points.slice();
  const first = points[0];
  const last = points[points.length - 1];
  const chord: Segment = { id: '', trackId: '', a: first, b: last };
  let maxDist = 0;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = projectPoint(points[i], chord).dist;
    if (d > maxDist) { maxDist = d; idx = i; }
  }
  if (maxDist <= toleranceM) return [first, last];
  const left = simplify(points.slice(0, idx + 1), toleranceM);
  const right = simplify(points.slice(idx), toleranceM);
  return left.slice(0, -1).concat(right);
}

export function toSegments(points: Pt[], trackId: string): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    out.push({ id: `${trackId}#${i}`, trackId, a: points[i], b: points[i + 1] });
  }
  return out;
}
```

- [ ] **Step 4: Тест проходит**

Run: `npx vitest run src/geometry/simplify.test.ts`
Expected: PASS, 4 теста.

- [ ] **Step 5: Commit**

```bash
git add src/geometry
git commit -m "feat(geometry): douglas-peucker simplify"
```

---

### Task 5: detect/types и detectX

**Files:**
- Create: `src/detect/types.ts`, `src/detect/detectX.ts`, `src/detect/detectX.test.ts`, `src/detect/testUtils.ts`

**Interfaces:**
- Consumes: `Segment`, `length`, `lineAngle`, `intersect`.
- Produces (`types.ts`):
  ```ts
  type LetterKind = 'X' | 'U' | 'I';
  const LETTER_CHAR: Record<LetterKind, string>; // X→'Х', U→'У', I→'Й'
  type Letter = { kind: LetterKind; score: number; center: Pt; up: Pt | null; size: number; segments: Segment[]; key: string };
  type Grade = 'perfect' | 'good' | 'crooked' | 'anagram';
  const GRADE_LABEL: Record<Grade, string>;
  type Word = { letters: [Letter, Letter, Letter]; text: string; correctOrder: boolean; score: number; grade: Grade; center: Pt; up: Pt; key: string };
  type DetectOptions = { sensitivity: number };
  function tolerance(opts: DetectOptions): number;   // 0.7–1.3
  function minScore(opts: DetectOptions): number;    // 30 / tolerance
  function letterKey(segments: Segment[]): string;
  function clamp01(v: number): number;
  ```
- Produces (`detectX.ts`): `function detectX(segments: Segment[], opts?: DetectOptions): Letter[]`
- Produces (`testUtils.ts`): `function seg(ax, ay, bx, by, trackId?): Segment`

- [ ] **Step 1: Общие типы и тестовый помощник**

`src/detect/types.ts`:
```ts
import type { Pt } from '../geometry/project';
import type { Segment } from '../geometry/segments';

export type LetterKind = 'X' | 'U' | 'I';
export const LETTER_CHAR: Record<LetterKind, string> = { X: 'Х', U: 'У', I: 'Й' };

export type Letter = {
  kind: LetterKind;
  score: number;        // 0–100
  center: Pt;
  up: Pt | null;        // единичный вектор «верх». У Х нет. У И два варианта: up и -up
  size: number;         // метры
  segments: Segment[];
  key: string;          // отсортированные id отрезков
};

export type Grade = 'perfect' | 'good' | 'crooked' | 'anagram';
export const GRADE_LABEL: Record<Grade, string> = {
  perfect: 'Эталонный', good: 'Годный', crooked: 'Кривой', anagram: 'Анаграмма',
};

export type Word = {
  letters: [Letter, Letter, Letter]; // в порядке чтения
  text: string;                      // 'ХУЙ', 'ЙУХ', ...
  correctOrder: boolean;
  score: number;                     // 0–100
  grade: Grade;
  center: Pt;
  up: Pt;
  key: string;
};

/** sensitivity от -1 (строго) до 1 (щедро). */
export type DetectOptions = { sensitivity: number };
export const DEFAULT_OPTIONS: DetectOptions = { sensitivity: 0 };

/** Коэффициент допусков: 1 при нуле, 1.3 при щедрой, 0.7 при строгой. */
export function tolerance(opts: DetectOptions): number {
  return 1 + 0.3 * Math.max(-1, Math.min(1, opts.sensitivity));
}

export function minScore(opts: DetectOptions): number {
  return 30 / tolerance(opts);
}

export function letterKey(segments: Segment[]): string {
  return segments.map((s) => s.id).sort().join('|');
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
```

`src/detect/testUtils.ts`:
```ts
import type { Segment } from '../geometry/segments';

let counter = 0;

/** Отрезок для тестов. trackId по умолчанию уникальный. */
export function seg(ax: number, ay: number, bx: number, by: number, trackId?: string): Segment {
  const tid = trackId ?? `t${counter++}`;
  return { id: `${tid}#${counter++}`, trackId: tid, a: { x: ax, y: ay }, b: { x: bx, y: by } };
}
```

- [ ] **Step 2: Тест detectX**

`src/detect/detectX.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectX } from './detectX';
import { seg } from './testUtils';

describe('detectX', () => {
  it('идеальный крест — оценка выше 90', () => {
    const res = detectX([seg(-1, -1, 1, 1), seg(-1, 1, 1, -1)]);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe('X');
    expect(res[0].score).toBeGreaterThan(90);
    expect(res[0].center.x).toBeCloseTo(0);
    expect(res[0].center.y).toBeCloseTo(0);
    expect(res[0].up).toBeNull();
  });

  it('косой крест — оценка между 30 и 90', () => {
    const res = detectX([seg(-1, -1, 1, 1), seg(-1, 0.6, 1, -0.6)]);
    expect(res).toHaveLength(1);
    expect(res[0].score).toBeGreaterThanOrEqual(30);
    expect(res[0].score).toBeLessThanOrEqual(90);
  });

  it('параллельные, V и Т — не крест', () => {
    expect(detectX([seg(0, 0, 1, 0), seg(0, 1, 1, 1)])).toEqual([]);
    expect(detectX([seg(0, 0, 1, 1), seg(0, 0, 1, -1)])).toEqual([]);
    expect(detectX([seg(-1, 0, 1, 0), seg(0, 0, 0, 1)])).toEqual([]);
  });

  it('слишком острый угол — не крест', () => {
    expect(detectX([seg(-1, 0, 1, 0), seg(-1, -0.3, 1, 0.3)])).toEqual([]);
  });

  it('отрезки одного трека не берём', () => {
    expect(detectX([seg(-1, -1, 1, 1, 'same'), seg(-1, 1, 1, -1, 'same')])).toEqual([]);
  });

  it('щедрая чувствительность пропускает более острый угол', () => {
    const segs = [seg(-1, 0, 1, 0), seg(-1, -0.7, 1, 0.7)]; // около 35°
    expect(detectX(segs, { sensitivity: 0 })).toEqual([]);
    expect(detectX(segs, { sensitivity: 1 })).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npx vitest run src/detect/detectX.test.ts`
Expected: FAIL, модуль `./detectX` не найден.

- [ ] **Step 4: Реализация**

`src/detect/detectX.ts`:
```ts
import { intersect, length, lineAngle, type Segment } from '../geometry/segments';
import { DEFAULT_OPTIONS, clamp01, letterKey, minScore, tolerance, type DetectOptions, type Letter } from './types';

/** Х: два отрезка разных треков пересекаются под углом 40–140° в средней части обоих. */
export function detectX(segments: Segment[], opts: DetectOptions = DEFAULT_OPTIONS): Letter[] {
  const k = tolerance(opts);
  const minAngle = 40 / k;     // острый угол между прямыми
  const margin = 0.15 / k;     // пересечение в [margin, 1 - margin] длины
  const maxRatio = 3 * k;
  const threshold = minScore(opts);
  const out: Letter[] = [];

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const s1 = segments[i];
      const s2 = segments[j];
      if (s1.trackId === s2.trackId) continue;
      const l1 = length(s1);
      const l2 = length(s2);
      if (l1 === 0 || l2 === 0) continue;
      if (Math.max(l1, l2) / Math.min(l1, l2) > maxRatio) continue;
      const angle = lineAngle(s1, s2);
      if (angle < minAngle) continue;
      const hit = intersect(s1, s2);
      if (!hit) continue;
      if (hit.t1 < margin || hit.t1 > 1 - margin || hit.t2 < margin || hit.t2 > 1 - margin) continue;

      const angleScore = clamp01(1 - (90 - angle) / 50);
      const midScore = (clamp01(1 - Math.abs(hit.t1 - 0.5) / 0.35) + clamp01(1 - Math.abs(hit.t2 - 0.5) / 0.35)) / 2;
      const score = Math.round((100 * (angleScore + midScore)) / 2);
      if (score < threshold) continue;

      out.push({
        kind: 'X', score, center: hit.point, up: null, size: (l1 + l2) / 2,
        segments: [s1, s2], key: letterKey([s1, s2]),
      });
    }
  }
  return out;
}
```

- [ ] **Step 5: Тест проходит**

Run: `npx vitest run src/detect/detectX.test.ts`
Expected: PASS, 6 тестов.

- [ ] **Step 6: Commit**

```bash
git add src/detect
git commit -m "feat(detect): letter types and X detector"
```

---

### Task 6: detectU

**Files:**
- Create: `src/detect/detectU.ts`, `src/detect/detectU.test.ts`

**Interfaces:**
- Consumes: `Segment`, `length`, `lineAngle`, `projectPoint`, `add`, `sub`, `scale`, `norm`, `dot`; типы из Task 5.
- Produces: `function detectU(segments: Segment[], opts?: DetectOptions): Letter[]`. У найденной У `up` направлен от точки касания к развилке, `center` — точка касания, `size` — длина длинного отрезка.

- [ ] **Step 1: Тест**

`src/detect/detectU.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectU } from './detectU';
import { seg } from './testUtils';

// Длинный штрих A наклонён на 25° от вертикали вправо, короткий B — зеркально влево, касается A в середине.
const A = () => seg(-0.233, -0.5, 0.233, 0.5);
const B = () => seg(-0.233, 0.5, 0, 0);

describe('detectU', () => {
  it('идеальная У — оценка выше 90, верх смотрит вверх', () => {
    const res = detectU([A(), B()]);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe('U');
    expect(res[0].score).toBeGreaterThan(90);
    expect(res[0].up!.x).toBeCloseTo(0, 2);
    expect(res[0].up!.y).toBeCloseTo(1, 2);
    expect(res[0].center.x).toBeCloseTo(0, 2);
    expect(res[0].center.y).toBeCloseTo(0, 2);
  });

  it('касание не в середине — оценка между 30 и 90', () => {
    // точка касания на 35% длины A: (-0.07, -0.15)
    const res = detectU([A(), seg(-0.303, 0.35, -0.07, -0.15)]);
    expect(res).toHaveLength(1);
    expect(res[0].score).toBeGreaterThanOrEqual(30);
    expect(res[0].score).toBeLessThanOrEqual(90);
  });

  it('Т, V и крест — не У', () => {
    expect(detectU([seg(-1, 0, 1, 0), seg(0, 0, 0, 0.5)])).toEqual([]);            // Т: угол 90
    expect(detectU([seg(0, 0, 0, 1), seg(0, 0, 0.5, 0.5)])).toEqual([]);            // V: касание в конце A
    expect(detectU([seg(-1, -1, 1, 1), seg(-0.6, 0.6, 0.6, -0.6)])).toEqual([]);    // крест: концы B далеко от A
  });

  it('отрезки одного трека не берём', () => {
    expect(detectU([seg(-0.233, -0.5, 0.233, 0.5, 'same'), seg(-0.233, 0.5, 0, 0, 'same')])).toEqual([]);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/detect/detectU.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация**

`src/detect/detectU.ts`:
```ts
import type { Pt } from '../geometry/project';
import { add, dot, length, lineAngle, norm, projectPoint, scale, sub, type Segment } from '../geometry/segments';
import { DEFAULT_OPTIONS, clamp01, letterKey, minScore, tolerance, type DetectOptions, type Letter } from './types';

/** У: короткий отрезок B упирается концом в среднюю часть длинного A под углом 25–85°. */
export function detectU(segments: Segment[], opts: DetectOptions = DEFAULT_OPTIONS): Letter[] {
  const k = tolerance(opts);
  const maxTouchDist = 0.1 * k;            // доля длины A
  const tMin = 0.3 / k;
  const tMax = 1 - 0.3 / k;
  const ratioMin = 0.25 / k;
  const ratioMax = 0.8 * k;
  const angleMin = 25 / k;
  const angleMax = Math.min(89, 85 * k);
  const threshold = minScore(opts);
  const out: Letter[] = [];

  for (const a of segments) {
    for (const b of segments) {
      if (a === b || a.trackId === b.trackId) continue;
      const la = length(a);
      const lb = length(b);
      if (la === 0 || lb === 0) continue;
      const ratio = lb / la;
      if (ratio < ratioMin || ratio > ratioMax) continue;
      const angle = lineAngle(a, b);
      if (angle < angleMin || angle > angleMax) continue;

      const ends: [Pt, Pt][] = [[b.a, b.b], [b.b, b.a]];
      for (const [touch, far] of ends) {
        const pr = projectPoint(touch, a);
        if (pr.dist > maxTouchDist * la || pr.t < tMin || pr.t > tMax) continue;
        const p = add(a.a, scale(sub(a.b, a.a), pr.t));
        // верхний конец A — по ту же сторону от точки касания, что и дальний конец B
        const armB = norm(sub(far, p));
        const upperA = dot(sub(a.a, p), armB) > 0 ? a.a : a.b;
        const up = norm(add(armB, norm(sub(upperA, p))));

        const angleScore = clamp01(1 - Math.abs(angle - 50) / 35);
        const midScore = clamp01(1 - Math.abs(pr.t - 0.5) / 0.25);
        const score = Math.round((100 * (angleScore + midScore)) / 2);
        if (score < threshold) continue;

        out.push({ kind: 'U', score, center: p, up, size: la, segments: [a, b], key: letterKey([a, b]) });
        break;
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Тест проходит**

Run: `npx vitest run src/detect/detectU.test.ts`
Expected: PASS, 4 теста.

- [ ] **Step 5: Commit**

```bash
git add src/detect
git commit -m "feat(detect): U detector"
```

---

### Task 7: detectI

**Files:**
- Create: `src/detect/detectI.ts`, `src/detect/detectI.test.ts`

**Interfaces:**
- Consumes: `Segment`, `length`, `lineAngle`, `projectPoint`, `midpoint`, `direction`, `dot`, `distance`; типы из Task 5.
- Produces: `function detectI(segments: Segment[], opts?: DetectOptions): Letter[]`. У И `up` — направление левого штриха (И симметрична: `-up` тоже верен), `center` — середина между штрихами, `size` — средняя длина штрихов, `segments` = `[левый, правый, диагональ]`.

- [ ] **Step 1: Тест**

`src/detect/detectI.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectI } from './detectI';
import { seg } from './testUtils';

const L = () => seg(-0.4, -0.5, -0.4, 0.5);
const R = () => seg(0.4, -0.5, 0.4, 0.5);

describe('detectI', () => {
  it('идеальная И — оценка выше 90', () => {
    const res = detectI([L(), R(), seg(-0.4, -0.5, 0.4, 0.5)]);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe('I');
    expect(res[0].score).toBeGreaterThan(90);
    expect(res[0].center.x).toBeCloseTo(0);
    expect(res[0].center.y).toBeCloseTo(0);
    expect(Math.abs(res[0].up!.y)).toBeCloseTo(1);
    expect(res[0].segments).toHaveLength(3);
  });

  it('диагональ не доходит до углов — оценка между 30 и 90', () => {
    const res = detectI([L(), R(), seg(-0.4, -0.4, 0.4, 0.4)]);
    expect(res).toHaveLength(1);
    expect(res[0].score).toBeGreaterThanOrEqual(30);
    expect(res[0].score).toBeLessThanOrEqual(90);
  });

  it('обратная диагональ (N) — не И', () => {
    expect(detectI([L(), R(), seg(-0.4, 0.5, 0.4, -0.5)])).toEqual([]);
  });

  it('две параллельные без диагонали — не И', () => {
    expect(detectI([L(), R()])).toEqual([]);
  });

  it('штрихи друг за другом, а не рядом — не И', () => {
    expect(detectI([seg(0, 0, 0, 1), seg(0, 2, 0, 3), seg(0, 0, 0, 3)])).toEqual([]);
  });

  it('диагональ того же трека, что штрих — не И', () => {
    expect(detectI([seg(-0.4, -0.5, -0.4, 0.5, 'same'), R(), seg(-0.4, -0.5, 0.4, 0.5, 'same')])).toEqual([]);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/detect/detectI.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация**

`src/detect/detectI.ts`:
```ts
import type { Pt } from '../geometry/project';
import { direction, distance, dot, length, lineAngle, midpoint, projectPoint, type Segment } from '../geometry/segments';
import { DEFAULT_OPTIONS, clamp01, letterKey, minScore, tolerance, type DetectOptions, type Letter } from './types';

/** Наименьшее из двух назначений концов диагонали на точки p и q. */
function endMismatch(d: Segment, p: Pt, q: Pt): number {
  const direct = Math.max(distance(d.a, p), distance(d.b, q));
  const swapped = Math.max(distance(d.a, q), distance(d.b, p));
  return Math.min(direct, swapped);
}

/** И: два почти параллельных штриха и диагональ от низа левого к верху правого. */
export function detectI(segments: Segment[], opts: DetectOptions = DEFAULT_OPTIONS): Letter[] {
  const k = tolerance(opts);
  const maxParallelAngle = 25 * k;
  const gapMin = 0.3 / k;
  const gapMax = 1.5 * k;
  const maxLenRatio = 2 * k;
  const endTol = 0.2 * k;
  const threshold = minScore(opts);
  const out: Letter[] = [];

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const s1 = segments[i];
      const s2 = segments[j];
      if (s1.trackId === s2.trackId) continue;
      const l1 = length(s1);
      const l2 = length(s2);
      if (l1 === 0 || l2 === 0) continue;
      if (Math.max(l1, l2) / Math.min(l1, l2) > maxLenRatio) continue;
      const angle = lineAngle(s1, s2);
      if (angle > maxParallelAngle) continue;
      const avg = (l1 + l2) / 2;
      const pr = projectPoint(midpoint(s2), s1);
      if (pr.t < 0 || pr.t > 1) continue;          // штрихи рядом, а не друг за другом
      const gap = pr.dist / avg;
      if (gap < gapMin || gap > gapMax) continue;

      // Берём up вдоль первого штриха. right — перпендикуляр по часовой стрелке.
      const up = direction(s1);
      const right = { x: up.y, y: -up.x };
      const s1IsLeft = dot(midpoint(s1), right) < dot(midpoint(s2), right);
      const left = s1IsLeft ? s1 : s2;
      const rightStroke = s1IsLeft ? s2 : s1;
      const bottomLeft = dot(left.a, up) < dot(left.b, up) ? left.a : left.b;
      const topRight = dot(rightStroke.a, up) > dot(rightStroke.b, up) ? rightStroke.a : rightStroke.b;

      for (const d of segments) {
        if (d.trackId === s1.trackId || d.trackId === s2.trackId) continue;
        const mismatch = endMismatch(d, bottomLeft, topRight);
        if (mismatch > endTol * avg) continue;

        const parallelScore = clamp01(1 - angle / 25);
        const gapScore = clamp01(1 - Math.abs(gap - 0.9) / 0.6);
        const endScore = clamp01(1 - mismatch / (endTol * avg));
        const score = Math.round((100 * (parallelScore + gapScore + endScore)) / 3);
        if (score < threshold) continue;

        const m1 = midpoint(left);
        const m2 = midpoint(rightStroke);
        out.push({
          kind: 'I', score, center: { x: (m1.x + m2.x) / 2, y: (m1.y + m2.y) / 2 }, up, size: avg,
          segments: [left, rightStroke, d], key: letterKey([left, rightStroke, d]),
        });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Тест проходит**

Run: `npx vitest run src/detect/detectI.test.ts`
Expected: PASS, 6 тестов.

- [ ] **Step 5: Commit**

```bash
git add src/detect
git commit -m "feat(detect): I detector"
```

---

### Task 8: detectWord — сборка слова и шкала идеальности

**Files:**
- Create: `src/detect/detectWord.ts`, `src/detect/detectWord.test.ts`

**Interfaces:**
- Consumes: `Letter`, `Word`, `Grade`, `LETTER_CHAR`, `tolerance`, `clamp01`; `angleDeg`, `dot`, `distance`, `neg`.
- Produces: `function detectWord(letters: Letter[], opts?: DetectOptions): Word[]` — отсортировано по убыванию `score`. Побочный эффект: у буквы И, вошедшей в слово, `up` разворачивается в сторону `up` слова (нужно для дужки).

- [ ] **Step 1: Тест**

`src/detect/detectWord.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectWord } from './detectWord';
import type { Letter, LetterKind } from './types';

let n = 0;
function letter(kind: LetterKind, x: number, y: number, up: { x: number; y: number } | null, score = 100, size = 1): Letter {
  n++;
  return { kind, score, center: { x, y }, up, size, segments: [], key: `k${n}` };
}

describe('detectWord', () => {
  it('идеальное ХУЙ в ряд — эталонный', () => {
    const res = detectWord([
      letter('X', -1.3, 0, null),
      letter('U', 0, 0, { x: 0, y: 1 }),
      letter('I', 1.3, 0, { x: 0, y: 1 }),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].text).toBe('ХУЙ');
    expect(res[0].correctOrder).toBe(true);
    expect(res[0].score).toBeGreaterThanOrEqual(90);
    expect(res[0].grade).toBe('perfect');
  });

  it('ХУЙ под наклоном 45° тоже находится', () => {
    const up = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
    const right = { x: up.y, y: -up.x };
    const at = (k: number) => ({ x: right.x * k, y: right.y * k });
    const res = detectWord([
      letter('X', at(-1.3).x, at(-1.3).y, null),
      letter('U', 0, 0, up),
      letter('I', at(1.3).x, at(1.3).y, up),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].text).toBe('ХУЙ');
  });

  it('ЙХУ в ряд — анаграмма с оценкой не выше 60', () => {
    const res = detectWord([
      letter('I', -1.3, 0, { x: 0, y: 1 }),
      letter('X', 0, 0, null),
      letter('U', 1.3, 0, { x: 0, y: 1 }),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].text).toBe('ЙХУ');
    expect(res[0].correctOrder).toBe(false);
    expect(res[0].grade).toBe('anagram');
    expect(res[0].score).toBeLessThanOrEqual(60);
  });

  it('И перевёрнутая (up вниз) всё равно подходит и разворачивается', () => {
    const i = letter('I', 1.3, 0, { x: 0, y: -1 });
    const res = detectWord([letter('X', -1.3, 0, null), letter('U', 0, 0, { x: 0, y: 1 }), i]);
    expect(res).toHaveLength(1);
    expect(i.up!.y).toBeCloseTo(1);
  });

  it('разный наклон У и И — не слово', () => {
    const res = detectWord([
      letter('X', -1.3, 0, null),
      letter('U', 0, 0, { x: 0, y: 1 }),
      letter('I', 1.3, 0, { x: 1, y: 0 }),
    ]);
    expect(res).toEqual([]);
  });

  it('буквы не в ряд — не слово', () => {
    const res = detectWord([
      letter('X', -1.3, 1.5, null),
      letter('U', 0, 0, { x: 0, y: 1 }),
      letter('I', 1.3, 0, { x: 0, y: 1 }),
    ]);
    expect(res).toEqual([]);
  });

  it('слишком далеко друг от друга — не слово', () => {
    const res = detectWord([
      letter('X', -5, 0, null),
      letter('U', 0, 0, { x: 0, y: 1 }),
      letter('I', 5, 0, { x: 0, y: 1 }),
    ]);
    expect(res).toEqual([]);
  });

  it('слабые буквы и кривой ряд дают слово ниже 40 — не показываем', () => {
    const res = detectWord([
      letter('X', -1.3, 0.45, null, 10),
      letter('U', 0, 0, { x: 0, y: 1 }, 10),
      letter('I', 1.3, -0.45, { x: 0, y: 1 }, 10),
    ]);
    expect(res).toEqual([]);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/detect/detectWord.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация**

`src/detect/detectWord.ts`:
```ts
import { angleDeg, distance, dot, neg } from '../geometry/segments';
import {
  DEFAULT_OPTIONS, LETTER_CHAR, clamp01, tolerance,
  type DetectOptions, type Grade, type Letter, type Word,
} from './types';

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function gradeOf(score: number, correctOrder: boolean): Grade {
  if (!correctOrder) return 'anagram';
  if (score >= 90) return 'perfect';
  if (score >= 70) return 'good';
  return 'crooked';
}

/** Слово: по одной Х, У, И в ряд с общим «верхом». Порядок влияет на оценку и grade. */
export function detectWord(letters: Letter[], opts: DetectOptions = DEFAULT_OPTIONS): Word[] {
  const k = tolerance(opts);
  const maxUpAngle = 35 * k;
  const maxRowDev = 0.5 * k;        // доля среднего размера
  const maxSizeRatio = 2.5 * k;
  const distMin = 0.5 / k;          // расстояние между центрами соседей, доли среднего размера
  const distMax = 3 * k;

  const xs = letters.filter((l) => l.kind === 'X');
  const us = letters.filter((l) => l.kind === 'U' && l.up);
  const is = letters.filter((l) => l.kind === 'I' && l.up);
  const seen = new Set<string>();
  const out: Word[] = [];

  for (const u of us) {
    const up = u.up!;
    const right = { x: up.y, y: -up.x };
    for (const i of is) {
      // И симметрична: подходит и up, и -up
      const flipped = angleDeg(up, neg(i.up!)) < angleDeg(up, i.up!);
      const upAngle = angleDeg(up, flipped ? neg(i.up!) : i.up!);
      if (upAngle > maxUpAngle) continue;
      for (const x of xs) {
        const trio = [x, u, i];
        const sizes = trio.map((l) => l.size);
        const avgSize = mean(sizes);
        if (Math.max(...sizes) / Math.min(...sizes) > maxSizeRatio) continue;

        const offs = trio.map((l) => dot(l.center, up));
        const meanOff = mean(offs);
        const maxDev = Math.max(...offs.map((o) => Math.abs(o - meanOff)));
        if (maxDev > maxRowDev * avgSize) continue;

        const ordered = [...trio].sort((p, q) => dot(p.center, right) - dot(q.center, right)) as [Letter, Letter, Letter];
        const d1 = distance(ordered[0].center, ordered[1].center);
        const d2 = distance(ordered[1].center, ordered[2].center);
        if (d1 < distMin * avgSize || d1 > distMax * avgSize) continue;
        if (d2 < distMin * avgSize || d2 > distMax * avgSize) continue;

        const text = ordered.map((l) => LETTER_CHAR[l.kind]).join('');
        const correctOrder = text === 'ХУЙ';

        const straight = clamp01(1 - maxDev / (maxRowDev * avgSize));
        const upMatch = clamp01(1 - upAngle / maxUpAngle);
        const sizeEq = Math.min(...sizes) / Math.max(...sizes);
        const gapEq = 1 - Math.abs(d1 - d2) / Math.max(d1, d2);
        const accuracy = (straight + upMatch + sizeEq + gapEq) / 4;
        let score = 0.6 * mean(trio.map((l) => l.score)) + 0.4 * 100 * accuracy;
        if (!correctOrder) score *= 0.6;
        score = Math.round(score);
        if (correctOrder && score < 40) continue;

        const key = trio.map((l) => l.key).sort().join('||');
        if (seen.has(key)) continue;
        seen.add(key);

        if (flipped) i.up = neg(i.up!);
        out.push({
          letters: ordered, text, correctOrder, score, grade: gradeOf(score, correctOrder),
          center: { x: mean(trio.map((l) => l.center.x)), y: mean(trio.map((l) => l.center.y)) },
          up, key,
        });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 4: Тест проходит**

Run: `npx vitest run src/detect/detectWord.test.ts`
Expected: PASS, 8 тестов.

- [ ] **Step 5: Commit**

```bash
git add src/detect
git commit -m "feat(detect): word assembly with perfection scale"
```

---

### Task 9: TrackStore и типы источника

**Files:**
- Create: `src/data/FlightSource.ts`, `src/tracks/TrackStore.ts`, `src/tracks/TrackStore.test.ts`

**Interfaces:**
- Produces (`FlightSource.ts`):
  ```ts
  type Position = { id: string; lat: number; lon: number; heading: number; timestamp: number }; // timestamp в мс
  type Bounds = { north: number; south: number; west: number; east: number };
  interface FlightSource { fetchPositions(bounds: Bounds, now: number): Promise<Position[]> }
  ```
- Produces (`TrackStore.ts`):
  ```ts
  type Track = { id: string; points: LatLon[]; lastSeen: number };
  class TrackStore {
    constructor(opts?: { maxAgeMs?: number; maxPoints?: number }); // 600000, 200
    add(positions: Position[], now: number): void;
    tracks(): Track[];
    clear(): void;
  }
  ```

- [ ] **Step 1: Типы источника**

`src/data/FlightSource.ts`:
```ts
export type Position = {
  id: string;
  lat: number;
  lon: number;
  heading: number;   // градусы по часовой от севера
  timestamp: number; // мс
};

export type Bounds = { north: number; south: number; west: number; east: number };

export interface FlightSource {
  fetchPositions(bounds: Bounds, now: number): Promise<Position[]>;
}
```

- [ ] **Step 2: Тест TrackStore**

`src/tracks/TrackStore.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { TrackStore } from './TrackStore';
import type { Position } from '../data/FlightSource';

const pos = (id: string, lat: number, lon: number): Position => ({ id, lat, lon, heading: 0, timestamp: 0 });

describe('TrackStore', () => {
  it('склеивает позиции одного id в трек по порядку', () => {
    const s = new TrackStore();
    s.add([pos('a', 1, 1), pos('b', 5, 5)], 1000);
    s.add([pos('a', 2, 2)], 2000);
    const a = s.tracks().find((t) => t.id === 'a')!;
    expect(a.points).toEqual([{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }]);
    expect(a.lastSeen).toBe(2000);
    expect(s.tracks()).toHaveLength(2);
  });

  it('повтор той же точки не добавляется', () => {
    const s = new TrackStore();
    s.add([pos('a', 1, 1)], 1000);
    s.add([pos('a', 1, 1)], 2000);
    expect(s.tracks()[0].points).toHaveLength(1);
  });

  it('удаляет протухшие треки', () => {
    const s = new TrackStore({ maxAgeMs: 1000 });
    s.add([pos('a', 1, 1)], 0);
    s.add([pos('b', 1, 1)], 500);
    s.add([], 1600);
    expect(s.tracks().map((t) => t.id)).toEqual(['b']);
  });

  it('обрезает длинные треки с начала', () => {
    const s = new TrackStore({ maxPoints: 3 });
    for (let i = 0; i < 5; i++) s.add([pos('a', i, i)], i);
    expect(s.tracks()[0].points.map((p) => p.lat)).toEqual([2, 3, 4]);
  });

  it('clear очищает всё', () => {
    const s = new TrackStore();
    s.add([pos('a', 1, 1)], 0);
    s.clear();
    expect(s.tracks()).toEqual([]);
  });
});
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npx vitest run src/tracks/TrackStore.test.ts`
Expected: FAIL.

- [ ] **Step 4: Реализация**

`src/tracks/TrackStore.ts`:
```ts
import type { LatLon } from '../geometry/project';
import type { Position } from '../data/FlightSource';

export type Track = { id: string; points: LatLon[]; lastSeen: number };

type Options = { maxAgeMs: number; maxPoints: number };

/** Склеивает позиции в треки по id. Удаляет треки без обновлений, обрезает длинные. */
export class TrackStore {
  private readonly map = new Map<string, Track>();
  private readonly opts: Options;

  constructor(opts: Partial<Options> = {}) {
    this.opts = { maxAgeMs: 600_000, maxPoints: 200, ...opts };
  }

  add(positions: Position[], now: number): void {
    for (const p of positions) {
      let t = this.map.get(p.id);
      if (!t) {
        t = { id: p.id, points: [], lastSeen: now };
        this.map.set(p.id, t);
      }
      const last = t.points[t.points.length - 1];
      if (!last || last.lat !== p.lat || last.lon !== p.lon) t.points.push({ lat: p.lat, lon: p.lon });
      if (t.points.length > this.opts.maxPoints) t.points.splice(0, t.points.length - this.opts.maxPoints);
      t.lastSeen = now;
    }
    for (const [id, t] of this.map) {
      if (now - t.lastSeen > this.opts.maxAgeMs) this.map.delete(id);
    }
  }

  tracks(): Track[] {
    return [...this.map.values()];
  }

  clear(): void {
    this.map.clear();
  }
}
```

- [ ] **Step 5: Тест проходит**

Run: `npx vitest run src/tracks/TrackStore.test.ts`
Expected: PASS, 5 тестов.

- [ ] **Step 6: Commit**

```bash
git add src/data src/tracks
git commit -m "feat(tracks): track store and flight source types"
```

---

### Task 10: analyze — конвейер треки → буквы → слова

**Files:**
- Create: `src/detect/analyze.ts`, `src/detect/analyze.test.ts`

**Interfaces:**
- Consumes: `Track`, `Bounds`, `makeProjection`, `simplify`, `toSegments`, `detectX/U/I`, `detectWord`.
- Produces:
  ```ts
  type Analysis = { projection: Projection; segmentCount: number; letters: Letter[]; words: Word[] };
  function analyze(tracks: Track[], bounds: Bounds, opts?: DetectOptions, simplifyToleranceM?: number): Analysis; // 2000 м
  ```

- [ ] **Step 1: Тест**

`src/detect/analyze.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { analyze } from './analyze';
import type { Track } from '../tracks/TrackStore';

const bounds = { north: 56, south: 54, west: 36, east: 40 };

// Прямой трек из нескольких точек между двумя координатами.
function track(id: string, from: [number, number], to: [number, number], n = 5): Track {
  const points = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    points.push({ lat: from[0] + (to[0] - from[0]) * t, lon: from[1] + (to[1] - from[1]) * t });
  }
  return { id, points, lastSeen: 0 };
}

describe('analyze', () => {
  it('два пересекающихся трека дают крест и ни одного слова', () => {
    const res = analyze([
      track('a', [54.5, 37], [55.5, 39]),
      track('b', [55.5, 37], [54.5, 39]),
    ], bounds);
    expect(res.segmentCount).toBe(2);
    expect(res.letters.map((l) => l.kind)).toEqual(['X']);
    expect(res.words).toEqual([]);
  });

  it('треки из одной точки пропускаются', () => {
    const res = analyze([{ id: 'a', points: [{ lat: 55, lon: 37 }], lastSeen: 0 }], bounds);
    expect(res.segmentCount).toBe(0);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/detect/analyze.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация**

`src/detect/analyze.ts`:
```ts
import { makeProjection, type Projection } from '../geometry/project';
import type { Segment } from '../geometry/segments';
import { simplify, toSegments } from '../geometry/simplify';
import type { Bounds } from '../data/FlightSource';
import type { Track } from '../tracks/TrackStore';
import { detectX } from './detectX';
import { detectU } from './detectU';
import { detectI } from './detectI';
import { detectWord } from './detectWord';
import { DEFAULT_OPTIONS, type DetectOptions, type Letter, type Word } from './types';

export type Analysis = {
  projection: Projection;
  segmentCount: number;
  letters: Letter[];
  words: Word[];
};

export const SIMPLIFY_TOLERANCE_M = 2000;

/** Треки → проекция → упрощение → отрезки → буквы → слова. */
export function analyze(
  tracks: Track[],
  bounds: Bounds,
  opts: DetectOptions = DEFAULT_OPTIONS,
  simplifyToleranceM = SIMPLIFY_TOLERANCE_M,
): Analysis {
  const projection = makeProjection({
    lat: (bounds.north + bounds.south) / 2,
    lon: (bounds.west + bounds.east) / 2,
  });
  const segments: Segment[] = [];
  for (const t of tracks) {
    if (t.points.length < 2) continue;
    const pts = simplify(t.points.map((p) => projection.toXY(p)), simplifyToleranceM);
    segments.push(...toSegments(pts, t.id));
  }
  const letters = [...detectX(segments, opts), ...detectU(segments, opts), ...detectI(segments, opts)];
  const words = detectWord(letters, opts);
  return { projection, segmentCount: segments.length, letters, words };
}
```

- [ ] **Step 4: Тест проходит**

Run: `npx vitest run src/detect/analyze.test.ts`
Expected: PASS, 2 теста.

- [ ] **Step 5: Commit**

```bash
git add src/detect
git commit -m "feat(detect): analyze pipeline"
```

---

### Task 11: MockSource — случайные рейсы

**Files:**
- Create: `src/data/random.ts`, `src/data/MockSource.ts`, `src/data/MockSource.test.ts`

**Interfaces:**
- Consumes: `FlightSource`, `Bounds`, `Position`.
- Produces:
  ```ts
  function mulberry32(seed: number): () => number;   // random.ts, [0, 1)
  class MockSource implements FlightSource {
    constructor(seed?: number, count?: number);       // 1, 60
    fetchPositions(bounds: Bounds, now: number): Promise<Position[]>;
  }
  ```
  Внутренний тип `Flight = { id, lat, lon, heading, speedKmh, remainingKm: number | null, nextTurnAt }` и помощники `moveKm`, `bearingDeg`, `localToLatLon` — экспортируются для Task 12.

- [ ] **Step 1: Тест**

`src/data/MockSource.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { MockSource } from './MockSource';
import { mulberry32 } from './random';
import type { Bounds } from './FlightSource';

const bounds: Bounds = { north: 56, south: 54, west: 36, east: 40 };

function distKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (b.lat - a.lat) * 111.32;
  const dLon = (b.lon - a.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

describe('mulberry32', () => {
  it('одно зерно — одна последовательность в [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 5; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('MockSource', () => {
  it('создаёт count рейсов внутри границ', async () => {
    const src = new MockSource(7, 25);
    const p = await src.fetchPositions(bounds, 0);
    expect(p).toHaveLength(25);
    for (const f of p) {
      expect(f.lat).toBeGreaterThanOrEqual(54);
      expect(f.lat).toBeLessThanOrEqual(56);
      expect(f.lon).toBeGreaterThanOrEqual(36);
      expect(f.lon).toBeLessThanOrEqual(40);
      expect(f.timestamp).toBe(0);
    }
  });

  it('одно зерно — одинаковые позиции', async () => {
    const a = new MockSource(3, 10);
    const b = new MockSource(3, 10);
    await a.fetchPositions(bounds, 0);
    await b.fetchPositions(bounds, 0);
    expect(await a.fetchPositions(bounds, 5000)).toEqual(await b.fetchPositions(bounds, 5000));
  });

  it('за минуту рейс пролетает 11–15 км по своему курсу', async () => {
    const src = new MockSource(11, 30);
    const before = await src.fetchPositions(bounds, 0);
    const after = await src.fetchPositions(bounds, 60_000);
    const byId = new Map(after.map((p) => [p.id, p]));
    let checked = 0;
    for (const b of before) {
      const a = byId.get(b.id);
      if (!a) continue; // вылетел за границы и заменён
      const d = distKm(b, a);
      expect(d).toBeGreaterThan(11);
      expect(d).toBeLessThan(15.5);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('вылетевший рейс заменяется новым: число рейсов постоянно', async () => {
    const src = new MockSource(5, 40);
    let now = 0;
    for (let i = 0; i < 30; i++) {
      now += 60_000;
      const p = await src.fetchPositions(bounds, now);
      expect(p).toHaveLength(40);
      for (const f of p) {
        expect(f.lat).toBeGreaterThanOrEqual(54);
        expect(f.lat).toBeLessThanOrEqual(56);
      }
    }
  });

  it('сильный сдвиг области пересоздаёт рейсы', async () => {
    const src = new MockSource(1, 10);
    const a = await src.fetchPositions(bounds, 0);
    const far: Bounds = { north: 46, south: 44, west: 6, east: 10 };
    const b = await src.fetchPositions(far, 5000);
    expect(b).toHaveLength(10);
    expect(b.every((p) => p.lat <= 46 && p.lat >= 44)).toBe(true);
    expect(new Set(b.map((p) => p.id)).size).toBe(10);
    expect(a.map((p) => p.id)).not.toEqual(b.map((p) => p.id));
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/data/MockSource.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация**

`src/data/random.ts`:
```ts
/** Детерминированный генератор случайных чисел в [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

`src/data/MockSource.ts`:
```ts
import type { Bounds, FlightSource, Position } from './FlightSource';
import type { LatLon } from '../geometry/project';
import { mulberry32 } from './random';

export const KM_PER_DEG = 111.32;
const DEG = Math.PI / 180;

export type Flight = {
  id: string;
  lat: number;
  lon: number;
  heading: number;             // градусы по часовой от севера
  speedKmh: number;
  remainingKm: number | null;  // null — обычный рейс; число — подсаженный, исчезает, когда долетит
  nextTurnAt: number;          // мс
};

/** Сдвинуть точку на km по курсу heading. */
export function moveKm(f: LatLon & { heading: number }, km: number): void {
  const h = f.heading * DEG;
  f.lat += (km * Math.cos(h)) / KM_PER_DEG;
  f.lon += (km * Math.sin(h)) / (KM_PER_DEG * Math.cos(f.lat * DEG));
}

/** Курс из точки a в точку b, градусы по часовой от севера. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const dLat = b.lat - a.lat;
  const dLon = (b.lon - a.lon) * Math.cos(a.lat * DEG);
  return ((Math.atan2(dLon, dLat) / DEG) + 360) % 360;
}

/** Локальные километры (x — восток, y — север) относительно центра → координаты. */
export function localToLatLon(center: LatLon, xKm: number, yKm: number): LatLon {
  return {
    lat: center.lat + yKm / KM_PER_DEG,
    lon: center.lon + xKm / (KM_PER_DEG * Math.cos(center.lat * DEG)),
  };
}

function inside(p: LatLon, b: Bounds): boolean {
  return p.lat >= b.south && p.lat <= b.north && p.lon >= b.west && p.lon <= b.east;
}

function movedFar(prev: Bounds, next: Bounds): boolean {
  const dLat = Math.abs((prev.north + prev.south) / 2 - (next.north + next.south) / 2);
  const dLon = Math.abs((prev.west + prev.east) / 2 - (next.west + next.east) / 2);
  return dLat > (prev.north - prev.south) / 2 || dLon > (prev.east - prev.west) / 2;
}

/** Генератор рейсов: случайные самолёты летят по курсу, иногда поворачивают, за границей заменяются. */
export class MockSource implements FlightSource {
  protected readonly rng: () => number;
  protected flights: Flight[] = [];
  protected bounds: Bounds | null = null;
  private lastNow: number | null = null;
  protected counter = 0;

  constructor(seed = 1, private readonly count = 60) {
    this.rng = mulberry32(seed);
  }

  async fetchPositions(bounds: Bounds, now: number): Promise<Position[]> {
    if (!this.bounds || movedFar(this.bounds, bounds)) {
      this.bounds = bounds;
      this.flights = this.flights.filter((f) => f.remainingKm !== null);
      for (let i = 0; i < this.count; i++) this.flights.push(this.randomFlight(bounds, now));
    }
    const dtH = this.lastNow === null ? 0 : (now - this.lastNow) / 3_600_000;
    this.lastNow = now;

    const next: Flight[] = [];
    for (const f of this.flights) {
      if (f.remainingKm !== null && f.remainingKm <= 0) continue; // подсаженный долетел
      const km = f.speedKmh * dtH;
      if (f.remainingKm !== null) {
        moveKm(f, Math.min(km, f.remainingKm));
        f.remainingKm -= km;
      } else {
        moveKm(f, km);
        if (now >= f.nextTurnAt) {
          const sign = this.rng() < 0.5 ? -1 : 1;
          f.heading = (f.heading + sign * this.range(10, 40) + 360) % 360;
          f.nextTurnAt = now + this.turnDelay();
        }
        if (!inside(f, bounds)) {
          next.push(this.edgeFlight(bounds, now));
          continue;
        }
      }
      next.push(f);
    }
    this.flights = next;
    return this.flights.map((f) => ({ id: f.id, lat: f.lat, lon: f.lon, heading: f.heading, timestamp: now }));
  }

  protected range(min: number, max: number): number {
    return min + (max - min) * this.rng();
  }

  private turnDelay(): number {
    return this.range(3, 5) * 60_000;
  }

  private randomFlight(b: Bounds, now: number): Flight {
    return {
      id: `mock-${this.counter++}`,
      lat: this.range(b.south, b.north),
      lon: this.range(b.west, b.east),
      heading: this.range(0, 360),
      speedKmh: this.range(700, 900),
      remainingKm: null,
      nextTurnAt: now + this.turnDelay(),
    };
  }

  /** Новый рейс на случайном краю области, летит внутрь. */
  private edgeFlight(b: Bounds, now: number): Flight {
    const side = Math.floor(this.range(0, 4));
    const start: LatLon =
      side === 0 ? { lat: b.north, lon: this.range(b.west, b.east) } :
      side === 1 ? { lat: b.south, lon: this.range(b.west, b.east) } :
      side === 2 ? { lat: this.range(b.south, b.north), lon: b.west } :
                   { lat: this.range(b.south, b.north), lon: b.east };
    const target: LatLon = { lat: this.range(b.south, b.north), lon: this.range(b.west, b.east) };
    return {
      id: `mock-${this.counter++}`,
      lat: start.lat,
      lon: start.lon,
      heading: bearingDeg(start, target),
      speedKmh: this.range(700, 900),
      remainingKm: null,
      nextTurnAt: now + this.turnDelay(),
    };
  }
}
```

- [ ] **Step 4: Тест проходит**

Run: `npx vitest run src/data/MockSource.test.ts`
Expected: PASS, 6 тестов.

- [ ] **Step 5: Commit**

```bash
git add src/data
git commit -m "feat(data): mock flight source with random flights"
```

---

### Task 12: MockSource — подсадка букв и слова

**Files:**
- Modify: `src/data/MockSource.ts` (добавить методы `plantLetter`, `plantWord`)
- Create: `src/data/MockSource.plant.test.ts`

**Interfaces:**
- Consumes: `LetterKind`, `TrackStore`, `analyze` (для теста).
- Produces:
  ```ts
  class MockSource {
    plantLetter(kind: LetterKind): boolean;  // false, если границы ещё неизвестны
    plantWord(): boolean;
  }
  ```
  Подсаженные рейсы имеют id `plant-N`, скорость 1200 км/ч, исчезают, долетев до конца штриха. Размер буквы — 12% высоты области. Слово ставится с наклоном ±40°.

- [ ] **Step 1: Тест**

`src/data/MockSource.plant.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { MockSource } from './MockSource';
import { TrackStore } from '../tracks/TrackStore';
import { analyze } from '../detect/analyze';
import type { Bounds } from './FlightSource';

const bounds: Bounds = { north: 56, south: 54, west: 36, east: 40 };

/** Гоняет источник шагами по 5 с, складывает в TrackStore, возвращает анализ. */
async function fly(src: MockSource, steps: number) {
  const store = new TrackStore();
  let now = 0;
  for (let i = 0; i < steps; i++) {
    now += 5000;
    store.add(await src.fetchPositions(bounds, now), now);
  }
  return analyze(store.tracks(), bounds);
}

describe('MockSource.plant', () => {
  it('без границ подсадка невозможна', () => {
    expect(new MockSource(1, 0).plantLetter('X')).toBe(false);
  });

  it('подсаженная Х находится детектором', async () => {
    const src = new MockSource(2, 0);
    await src.fetchPositions(bounds, 0);
    expect(src.plantLetter('X')).toBe(true);
    const res = await fly(src, 60);
    expect(res.letters.some((l) => l.kind === 'X' && l.score > 70)).toBe(true);
  });

  it('подсаженная У и И находятся', async () => {
    for (const kind of ['U', 'I'] as const) {
      const src = new MockSource(3, 0);
      await src.fetchPositions(bounds, 0);
      src.plantLetter(kind);
      const res = await fly(src, 60);
      expect(res.letters.some((l) => l.kind === kind && l.score > 70)).toBe(true);
    }
  });

  it('подсаженное слово собирается в ХУЙ', async () => {
    for (const seed of [4, 5, 6]) {
      const src = new MockSource(seed, 0);
      await src.fetchPositions(bounds, 0);
      expect(src.plantWord()).toBe(true);
      const res = await fly(src, 60);
      const word = res.words.find((w) => w.correctOrder);
      expect(word, `seed ${seed}`).toBeDefined();
      expect(word!.score).toBeGreaterThanOrEqual(70);
    }
  });

  it('долетевшие подсаженные рейсы исчезают из позиций', async () => {
    const src = new MockSource(7, 0);
    await src.fetchPositions(bounds, 0);
    src.plantLetter('X');
    let now = 0;
    for (let i = 0; i < 120; i++) {
      now += 5000;
      await src.fetchPositions(bounds, now);
    }
    expect(await src.fetchPositions(bounds, now + 5000)).toEqual([]);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/data/MockSource.plant.test.ts`
Expected: FAIL, `plantLetter` не функция.

- [ ] **Step 3: Реализация**

Добавить в начало `src/data/MockSource.ts` импорт и таблицу штрихов:
```ts
import type { LetterKind } from '../detect/types';

/** Штрихи букв в долях размера L: [x1, y1, x2, y2], x — вправо, y — вверх. */
const STROKES: Record<LetterKind, [number, number, number, number][]> = {
  X: [[-0.5, -0.5, 0.5, 0.5], [-0.5, 0.5, 0.5, -0.5]],
  U: [[-0.233, -0.5, 0.233, 0.5], [-0.233, 0.5, 0, 0]],
  I: [[-0.4, -0.5, -0.4, 0.5], [0.4, -0.5, 0.4, 0.5], [-0.4, -0.5, 0.4, 0.5]],
};
const WORD: { kind: LetterKind; dx: number }[] = [
  { kind: 'X', dx: -1.3 }, { kind: 'U', dx: 0 }, { kind: 'I', dx: 1.3 },
];
const PLANT_SPEED_KMH = 1200;
```

Добавить в класс `MockSource` методы:
```ts
  /** Подсадить букву в случайное место области. */
  plantLetter(kind: LetterKind): boolean {
    if (!this.bounds) return false;
    const b = this.bounds;
    const sizeKm = this.letterSizeKm(b);
    const center = {
      lat: this.range(b.south + 0.25 * (b.north - b.south), b.north - 0.25 * (b.north - b.south)),
      lon: this.range(b.west + 0.25 * (b.east - b.west), b.east - 0.25 * (b.east - b.west)),
    };
    this.plantStrokes(kind, center, sizeKm, this.range(-40, 40));
    return true;
  }

  /** Подсадить слово ХУЙ с общим наклоном. */
  plantWord(): boolean {
    if (!this.bounds) return false;
    const b = this.bounds;
    const sizeKm = this.letterSizeKm(b);
    const rotation = this.range(-40, 40);
    const center = {
      lat: this.range(b.south + 0.3 * (b.north - b.south), b.north - 0.3 * (b.north - b.south)),
      lon: this.range(b.west + 0.3 * (b.east - b.west), b.east - 0.3 * (b.east - b.west)),
    };
    for (const { kind, dx } of WORD) {
      const [ox, oy] = rotate(dx * sizeKm, 0, rotation);
      this.plantStrokes(kind, localToLatLon(center, ox, oy), sizeKm, rotation);
    }
    return true;
  }

  private letterSizeKm(b: Bounds): number {
    return 0.12 * (b.north - b.south) * KM_PER_DEG;
  }

  /** Каждый штрих — рейс, который стартует в начале штриха и исчезает в его конце. */
  private plantStrokes(kind: LetterKind, center: LatLon, sizeKm: number, rotationDeg: number): void {
    for (const [x1, y1, x2, y2] of STROKES[kind]) {
      const noise = () => this.range(-0.05, 0.05) * sizeKm;
      const [sx, sy] = rotate(x1 * sizeKm + noise(), y1 * sizeKm + noise(), rotationDeg);
      const [ex, ey] = rotate(x2 * sizeKm, y2 * sizeKm, rotationDeg);
      const start = localToLatLon(center, sx, sy);
      const end = localToLatLon(center, ex, ey);
      this.flights.push({
        id: `plant-${this.counter++}`,
        lat: start.lat,
        lon: start.lon,
        heading: (bearingDeg(start, end) + this.range(-2, 2) + 360) % 360,
        speedKmh: PLANT_SPEED_KMH,
        remainingKm: Math.hypot(ex - sx, ey - sy),
        nextTurnAt: Number.POSITIVE_INFINITY,
      });
    }
  }
```

И функцию поворота на уровне модуля:
```ts
/** Поворот вектора (x, y) против часовой стрелки на deg градусов. */
function rotate(x: number, y: number, deg: number): [number, number] {
  const r = deg * DEG;
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
}
```

- [ ] **Step 4: Тест проходит**

Run: `npx vitest run src/data/MockSource.plant.test.ts`
Expected: PASS, 5 тестов. Если слово для какого-то зерна не собирается — смотреть, какие буквы нашлись (`res.letters`), и подбирать `STROKES`, а не ослаблять детекторы.

- [ ] **Step 5: Прогнать все тесты**

Run: `npm test`
Expected: PASS, все файлы зелёные.

- [ ] **Step 6: Commit**

```bash
git add src/data
git commit -m "feat(data): plant letters and word into mock source"
```

---

### Task 13: Fr24Source — адаптер API

**Files:**
- Create: `src/data/Fr24Source.ts`, `src/data/Fr24Source.test.ts`

**Interfaces:**
- Consumes: `FlightSource`, `Bounds`, `Position`.
- Produces:
  ```ts
  class Fr24Error extends Error { status: number }
  class Fr24Source implements FlightSource {
    constructor(key: string, fetchFn?: typeof fetch, baseUrl?: string); // globalThis.fetch, 'https://fr24api.flightradar24.com/api/'
    fetchPositions(bounds: Bounds, now: number): Promise<Position[]>;
  }
  ```

- [ ] **Step 1: Тест**

`src/data/Fr24Source.test.ts`:
```ts
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
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/data/Fr24Source.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация**

`src/data/Fr24Source.ts`:
```ts
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

  async fetchPositions(bounds: Bounds): Promise<Position[]> {
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
```

- [ ] **Step 4: Тест проходит**

Run: `npx vitest run src/data/Fr24Source.test.ts`
Expected: PASS, 3 теста.

- [ ] **Step 5: Commit**

```bash
git add src/data
git commit -m "feat(data): flightradar24 source adapter"
```

---

### Task 14: useScanner — цикл опроса

**Files:**
- Create: `src/composables/useScanner.ts`, `src/composables/useScanner.test.ts`

**Interfaces:**
- Consumes: `FlightSource`, `Bounds`, `TrackStore`, `Track`, `analyze`, `Analysis`, `Fr24Error`.
- Produces:
  ```ts
  type ScannerStatus = 'idle' | 'running' | 'stopped-error';
  function useScanner(options: {
    source: Ref<FlightSource>;
    getBounds: () => Bounds | null;
    intervalMs: Ref<number>;
    sensitivity: Ref<number>;
  }): {
    analysis: ShallowRef<Analysis | null>;
    tracks: ShallowRef<Track[]>;
    error: Ref<string | null>;
    status: Ref<ScannerStatus>;
    start(): void; stop(): void; reset(): void;
    tick(): Promise<void>;   // один шаг цикла, для тестов и кнопки «обновить»
  }
  ```

- [ ] **Step 1: Тест**

`src/composables/useScanner.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useScanner } from './useScanner';
import { Fr24Error } from '../data/Fr24Source';
import type { FlightSource, Position } from '../data/FlightSource';

const bounds = { north: 56, south: 54, west: 36, east: 40 };

function stubSource(impl: () => Promise<Position[]>): FlightSource {
  return { fetchPositions: impl };
}

function setup(source: FlightSource, intervalMs = 1000) {
  return useScanner({
    source: ref(source),
    getBounds: () => bounds,
    intervalMs: ref(intervalMs),
    sensitivity: ref(0),
  });
}

describe('useScanner', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('tick складывает позиции и считает анализ', async () => {
    const s = setup(stubSource(async () => [
      { id: 'a', lat: 55, lon: 37, heading: 0, timestamp: 0 },
    ]));
    await s.tick();
    expect(s.tracks.value).toHaveLength(1);
    expect(s.analysis.value).not.toBeNull();
    expect(s.error.value).toBeNull();
  });

  it('start опрашивает по интервалу, stop прекращает', async () => {
    const fetch = vi.fn(async () => [] as Position[]);
    const s = setup(stubSource(fetch), 1000);
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetch).toHaveBeenCalledTimes(3);
    s.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(s.status.value).toBe('idle');
  });

  it('сетевая ошибка: сообщение записано, опрос продолжается, после трёх ошибок интервал растёт', async () => {
    const fetch = vi.fn(async () => { throw new Error('network down'); });
    const s = setup(stubSource(fetch), 1000);
    s.start();
    await vi.advanceTimersByTimeAsync(0);       // 1-я ошибка → следующий через 1000
    await vi.advanceTimersByTimeAsync(1000);    // 2-я → через 1000
    await vi.advanceTimersByTimeAsync(1000);    // 3-я → через 2000
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(s.error.value).toBe('network down');
    expect(s.status.value).toBe('running');
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(3);     // ещё рано
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(4);
    s.stop();
  });

  it('401/402/403 останавливает опрос', async () => {
    const fetch = vi.fn(async () => { throw new Fr24Error(402, 'Credits exhausted'); });
    const s = setup(stubSource(fetch), 1000);
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(s.status.value).toBe('stopped-error');
    expect(s.error.value).toBe('402: Credits exhausted');
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reset очищает треки и анализ', async () => {
    const s = setup(stubSource(async () => [{ id: 'a', lat: 55, lon: 37, heading: 0, timestamp: 0 }]));
    await s.tick();
    s.reset();
    expect(s.tracks.value).toEqual([]);
    expect(s.analysis.value).toBeNull();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/composables/useScanner.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация**

`src/composables/useScanner.ts`:
```ts
import { getCurrentInstance, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue';
import type { Bounds, FlightSource } from '../data/FlightSource';
import { Fr24Error } from '../data/Fr24Source';
import { TrackStore, type Track } from '../tracks/TrackStore';
import { analyze, type Analysis } from '../detect/analyze';

export type ScannerStatus = 'idle' | 'running' | 'stopped-error';

type Options = {
  source: Ref<FlightSource>;
  getBounds: () => Bounds | null;
  intervalMs: Ref<number>;
  sensitivity: Ref<number>;
};

const MAX_BACKOFF_MS = 120_000;
const FATAL_STATUSES = new Set([401, 402, 403]);

/** Цикл: опрос источника → TrackStore → analyze → реактивный результат. */
export function useScanner(options: Options) {
  const store = new TrackStore();
  const analysis = shallowRef<Analysis | null>(null);
  const tracks = shallowRef<Track[]>([]);
  const error = ref<string | null>(null);
  const status = ref<ScannerStatus>('idle');
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;

  function recompute(bounds: Bounds): void {
    tracks.value = store.tracks();
    analysis.value = analyze(tracks.value, bounds, { sensitivity: options.sensitivity.value });
  }

  function schedule(ms: number): void {
    if (status.value !== 'running') return;
    timer = setTimeout(() => void tick(), ms);
  }

  async function tick(): Promise<void> {
    const bounds = options.getBounds();
    if (!bounds) {
      schedule(options.intervalMs.value);
      return;
    }
    const now = Date.now();
    try {
      const positions = await options.source.value.fetchPositions(bounds, now);
      store.add(positions, now);
      failures = 0;
      error.value = null;
      recompute(bounds);
      schedule(options.intervalMs.value);
    } catch (e) {
      if (e instanceof Fr24Error && FATAL_STATUSES.has(e.status)) {
        status.value = 'stopped-error';
        error.value = `${e.status}: ${e.message}`;
        return;
      }
      failures++;
      error.value = e instanceof Error ? e.message : String(e);
      const base = options.intervalMs.value;
      const delay = failures >= 3 ? Math.min(base * 2 ** (failures - 2), MAX_BACKOFF_MS) : base;
      schedule(delay);
    }
  }

  function start(): void {
    if (status.value === 'running') return;
    status.value = 'running';
    failures = 0;
    error.value = null;
    void tick();
  }

  function stop(): void {
    status.value = 'idle';
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function reset(): void {
    store.clear();
    tracks.value = [];
    analysis.value = null;
  }

  watch(options.sensitivity, () => {
    const b = options.getBounds();
    if (b && tracks.value.length) recompute(b);
  });

  if (getCurrentInstance()) onUnmounted(stop);

  return { analysis, tracks, error, status, start, stop, reset, tick };
}
```

- [ ] **Step 4: Тест проходит**

Run: `npx vitest run src/composables/useScanner.test.ts`
Expected: PASS, 5 тестов.

- [ ] **Step 5: Commit**

```bash
git add src/composables
git commit -m "feat: scanner loop composable"
```

---

### Task 15: map/geojson — результат → GeoJSON

**Files:**
- Create: `src/map/geojson.ts`, `src/map/geojson.test.ts`

**Interfaces:**
- Consumes: `Track`, `Letter`, `Word`, `Projection`, `LETTER_CHAR`.
- Produces:
  ```ts
  function tracksToGeoJson(tracks: Track[]): FeatureCollection;   // LineString на трек, properties { id }
  function lettersToGeoJson(letters: Letter[], proj: Projection): { strokes: FeatureCollection; labels: FeatureCollection };
  // strokes: LineString на отрезок буквы, properties { kind, score, key }; для И ещё дужка с kind 'breve'
  // labels: Point в центре буквы, properties { kind, label: 'Х 87%' }
  function wordsToGeoJson(words: Word[], proj: Projection): { outlines: FeatureCollection; labels: FeatureCollection };
  // outlines: замкнутый LineString-прямоугольник вокруг слова, properties { grade, score, text, key }
  // labels: Point над словом, properties { grade, label: 'ХУЙ 93%' }
  ```

- [ ] **Step 1: Тест**

`src/map/geojson.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { lettersToGeoJson, tracksToGeoJson, wordsToGeoJson } from './geojson';
import { makeProjection } from '../geometry/project';
import type { Letter, Word } from '../detect/types';
import { seg } from '../detect/testUtils';

const proj = makeProjection({ lat: 55, lon: 37 });

describe('geojson', () => {
  it('треки — по LineString на трек, точки как [lon, lat]', () => {
    const fc = tracksToGeoJson([{ id: 'a', points: [{ lat: 55, lon: 37 }, { lat: 56, lon: 38 }], lastSeen: 0 }]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry).toEqual({ type: 'LineString', coordinates: [[37, 55], [38, 56]] });
    expect(fc.features[0].properties).toEqual({ id: 'a' });
  });

  it('буква — отрезки и подпись; у И добавляется дужка', () => {
    const i: Letter = {
      kind: 'I', score: 88, center: { x: 0, y: 0 }, up: { x: 0, y: 1 }, size: 10_000,
      segments: [seg(-4000, -5000, -4000, 5000), seg(4000, -5000, 4000, 5000), seg(-4000, -5000, 4000, 5000)],
      key: 'i',
    };
    const { strokes, labels } = lettersToGeoJson([i], proj);
    expect(strokes.features).toHaveLength(4);
    const breve = strokes.features.find((f) => f.properties!.kind === 'breve')!;
    expect(breve).toBeDefined();
    const [[, lat1], [, lat2]] = (breve.geometry as GeoJSON.LineString).coordinates;
    expect(lat1).toBeGreaterThan(55.05); // дужка выше верха буквы (5 км ≈ 0.045°)
    expect(lat1).toBeCloseTo(lat2, 6);
    expect(labels.features[0].properties!.label).toBe('Й 88%');
  });

  it('слово — прямоугольник и подпись с уровнем', () => {
    const mk = (kind: Letter['kind'], x: number): Letter => ({
      kind, score: 100, center: { x, y: 0 }, up: { x: 0, y: 1 }, size: 10_000, segments: [], key: kind,
    });
    const word: Word = {
      letters: [mk('X', -13_000), mk('U', 0), mk('I', 13_000)],
      text: 'ХУЙ', correctOrder: true, score: 93, grade: 'perfect',
      center: { x: 0, y: 0 }, up: { x: 0, y: 1 }, key: 'w',
    };
    const { outlines, labels } = wordsToGeoJson([word], proj);
    const ring = (outlines.features[0].geometry as GeoJSON.LineString).coordinates;
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    expect(outlines.features[0].properties).toMatchObject({ grade: 'perfect', score: 93, text: 'ХУЙ' });
    expect(labels.features[0].properties!.label).toBe('ХУЙ 93%');
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/map/geojson.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация**

`src/map/geojson.ts`:
```ts
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { Projection, Pt } from '../geometry/project';
import { add, scale, dot } from '../geometry/segments';
import type { Track } from '../tracks/TrackStore';
import { LETTER_CHAR, type Letter, type Word } from '../detect/types';

function fc(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features };
}

function line(coords: [number, number][], properties: Record<string, unknown>): Feature<LineString> {
  return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties };
}

function point(coord: [number, number], properties: Record<string, unknown>): Feature<Point> {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: coord }, properties };
}

function toCoord(proj: Projection, p: Pt): [number, number] {
  const ll = proj.toLatLon(p);
  return [ll.lon, ll.lat];
}

export function tracksToGeoJson(tracks: Track[]): FeatureCollection {
  return fc(tracks
    .filter((t) => t.points.length >= 2)
    .map((t) => line(t.points.map((p) => [p.lon, p.lat] as [number, number]), { id: t.id })));
}

export function lettersToGeoJson(letters: Letter[], proj: Projection): { strokes: FeatureCollection; labels: FeatureCollection } {
  const strokes: Feature[] = [];
  const labels: Feature[] = [];
  for (const l of letters) {
    for (const s of l.segments) {
      strokes.push(line([toCoord(proj, s.a), toCoord(proj, s.b)], { kind: l.kind, score: l.score, key: l.key }));
    }
    if (l.kind === 'I' && l.up) {
      // дужка: над верхом буквы, длиной 40% ширины
      const right = { x: l.up.y, y: -l.up.x };
      const top = add(l.center, scale(l.up, 0.65 * l.size));
      const half = 0.2 * l.size;
      strokes.push(line([toCoord(proj, add(top, scale(right, -half))), toCoord(proj, add(top, scale(right, half)))],
        { kind: 'breve', score: l.score, key: l.key }));
    }
    labels.push(point(toCoord(proj, l.center), { kind: l.kind, label: `${LETTER_CHAR[l.kind]} ${l.score}%` }));
  }
  return { strokes: fc(strokes), labels: fc(labels) };
}

export function wordsToGeoJson(words: Word[], proj: Projection): { outlines: FeatureCollection; labels: FeatureCollection } {
  const outlines: Feature[] = [];
  const labels: Feature[] = [];
  for (const w of words) {
    const right = { x: w.up.y, y: -w.up.x };
    const maxSize = Math.max(...w.letters.map((l) => l.size));
    const along = w.letters.map((l) => dot(l.center, right));
    const minA = Math.min(...along) - 0.6 * maxSize;
    const maxA = Math.max(...along) + 0.6 * maxSize;
    const mid = dot(w.center, w.up);
    const corner = (a: number, u: number): Pt => add(scale(right, a), scale(w.up, u));
    const ring: Pt[] = [
      corner(minA, mid - 0.7 * maxSize), corner(maxA, mid - 0.7 * maxSize),
      corner(maxA, mid + 0.7 * maxSize), corner(minA, mid + 0.7 * maxSize),
    ];
    ring.push(ring[0]);
    outlines.push(line(ring.map((p) => toCoord(proj, p)), { grade: w.grade, score: w.score, text: w.text, key: w.key }));
    labels.push(point(toCoord(proj, add(w.center, scale(w.up, 0.9 * maxSize))), { grade: w.grade, label: `${w.text} ${w.score}%` }));
  }
  return { outlines: fc(outlines), labels: fc(labels) };
}
```

- [ ] **Step 4: Тест проходит**

Run: `npx vitest run src/map/geojson.test.ts`
Expected: PASS, 3 теста.

- [ ] **Step 5: Commit**

```bash
git add src/map
git commit -m "feat(map): geojson builders for tracks, letters, words"
```

---

### Task 16: MapView.vue — карта и слои

**Files:**
- Create: `src/map/MapView.vue`

**Interfaces:**
- Consumes: `Analysis`, `Track`, `Bounds`, `tracksToGeoJson`, `lettersToGeoJson`, `wordsToGeoJson`.
- Produces: компонент
  ```ts
  props: { analysis: Analysis | null; tracks: Track[] }
  emits: { bounds: [b: Bounds] }         // при загрузке и после каждого сдвига карты
  expose: { flyTo(lon: number, lat: number): void }
  ```

- [ ] **Step 1: Компонент**

`src/map/MapView.vue`:
```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection } from 'geojson';
import type { Bounds } from '../data/FlightSource';
import type { Track } from '../tracks/TrackStore';
import type { Analysis } from '../detect/analyze';
import { lettersToGeoJson, tracksToGeoJson, wordsToGeoJson } from './geojson';

const props = defineProps<{ analysis: Analysis | null; tracks: Track[] }>();
const emit = defineEmits<{ bounds: [b: Bounds] }>();

const container = ref<HTMLDivElement | null>(null);
let map: maplibregl.Map | null = null;
let ready = false;
let blinkTimer: ReturnType<typeof setInterval> | null = null;

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const SOURCES = ['tracks', 'letter-strokes', 'letter-labels', 'word-outlines', 'word-labels'] as const;

const LETTER_COLOR = ['match', ['get', 'kind'], 'X', '#ff5252', 'U', '#ffb300', 'I', '#40c4ff', 'breve', '#40c4ff', '#ffffff'];
const GRADE_COLOR = ['match', ['get', 'grade'], 'perfect', '#ff1744', 'good', '#ff9100', 'crooked', '#b39ddb', '#9e9e9e'];

function currentBounds(): Bounds {
  const b = map!.getBounds();
  return { north: b.getNorth(), south: b.getSouth(), west: b.getWest(), east: b.getEast() };
}

function setData(id: (typeof SOURCES)[number], data: FeatureCollection): void {
  const src = map?.getSource(id) as GeoJSONSource | undefined;
  src?.setData(data);
}

function render(): void {
  if (!map || !ready) return;
  setData('tracks', tracksToGeoJson(props.tracks));
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

function addLayers(m: maplibregl.Map): void {
  for (const id of SOURCES) m.addSource(id, { type: 'geojson', data: EMPTY });

  m.addLayer({ id: 'tracks', type: 'line', source: 'tracks',
    paint: { 'line-color': '#7a7a7a', 'line-width': 1, 'line-opacity': 0.7 } });

  m.addLayer({ id: 'letter-strokes', type: 'line', source: 'letter-strokes',
    paint: { 'line-color': LETTER_COLOR as never, 'line-width': 3 } });

  m.addLayer({ id: 'letter-labels', type: 'symbol', source: 'letter-labels',
    layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-offset': [0, -1.2] },
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
    layout: { 'text-field': ['get', 'label'], 'text-size': ['match', ['get', 'grade'], 'perfect', 28, 'good', 22, 16] as never, 'text-allow-overlap': true },
    paint: { 'text-color': GRADE_COLOR as never, 'text-halo-color': '#000000', 'text-halo-width': 2 } });

  let on = true;
  blinkTimer = setInterval(() => {
    on = !on;
    m.setPaintProperty('word-outlines-perfect', 'line-opacity', on ? 1 : 0.2);
  }, 500);
}

onMounted(() => {
  map = new maplibregl.Map({
    container: container.value!,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [37.6, 55.7],
    zoom: 6,
  });
  map.addControl(new maplibregl.NavigationControl(), 'top-right');
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
  map?.remove();
  map = null;
});

watch(() => [props.analysis, props.tracks], render);

defineExpose({
  flyTo(lon: number, lat: number) {
    map?.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 7) });
  },
});
</script>

<template>
  <div ref="container" class="map" />
</template>

<style scoped>
.map {
  position: absolute;
  inset: 0;
}
</style>
```

- [ ] **Step 2: Проверить типы**

Run: `npm run typecheck`
Expected: без ошибок. Если MapLibre ругается на типы выражений — оставить приведение `as never`, это известная особенность типов выражений.

- [ ] **Step 3: Commit**

```bash
git add src/map
git commit -m "feat(map): maplibre view with track, letter and word layers"
```

---

### Task 17: Controls.vue, Findings.vue и сборка App.vue

**Files:**
- Create: `src/ui/Controls.vue`, `src/ui/Findings.vue`
- Modify: `src/App.vue` (заменить заглушку)

**Interfaces:**
- Consumes: `MockSource`, `Fr24Source`, `useScanner`, `MapView`, типы `Letter`, `Word`, `LetterKind`, `GRADE_LABEL`, `LETTER_CHAR`, `ScannerStatus`.
- Produces: рабочее приложение. `Controls.vue`:
  ```ts
  defineModel<'mock' | 'api'>('mode'); defineModel<number>('intervalMs'); defineModel<number>('sensitivity');
  props: { hasKey: boolean; status: ScannerStatus; error: string | null }
  emits: { plantLetter: [kind: LetterKind]; plantWord: []; start: []; stop: []; gotoDemo: [] }
  ```
  `Findings.vue`:
  ```ts
  props: { words: Word[]; letters: Letter[] }
  emits: { select: [word: Word] }
  ```

- [ ] **Step 1: Controls.vue**

`src/ui/Controls.vue`:
```vue
<script setup lang="ts">
import type { LetterKind } from '../detect/types';
import type { ScannerStatus } from '../composables/useScanner';

const mode = defineModel<'mock' | 'api'>('mode', { required: true });
const intervalMs = defineModel<number>('intervalMs', { required: true });
const sensitivity = defineModel<number>('sensitivity', { required: true });

defineProps<{ hasKey: boolean; status: ScannerStatus; error: string | null }>();
const emit = defineEmits<{
  plantLetter: [kind: LetterKind];
  plantWord: [];
  start: [];
  stop: [];
  gotoDemo: [];
}>();
</script>

<template>
  <section class="controls">
    <h1>Huy Finder</h1>

    <label>
      Источник
      <select v-model="mode">
        <option value="mock">Демо (генератор)</option>
        <option value="api" :disabled="!hasKey">{{ hasKey ? 'Flightradar24 API' : 'Flightradar24 API — нет ключа' }}</option>
      </select>
    </label>

    <label>
      Опрос каждые {{ Math.round(intervalMs / 1000) }} с
      <input v-model.number="intervalMs" type="range" min="2000" max="60000" step="1000" />
    </label>

    <label>
      Чувствительность {{ sensitivity.toFixed(1) }}
      <input v-model.number="sensitivity" type="range" min="-1" max="1" step="0.1" />
    </label>

    <div class="row">
      <button v-if="status !== 'running'" @click="emit('start')">Старт</button>
      <button v-else @click="emit('stop')">Стоп</button>
    </div>

    <div v-if="mode === 'mock'" class="row">
      <span>Подбросить:</span>
      <button @click="emit('plantLetter', 'X')">Х</button>
      <button @click="emit('plantLetter', 'U')">У</button>
      <button @click="emit('plantLetter', 'I')">Й</button>
      <button @click="emit('plantWord')">Слово</button>
    </div>

    <p v-if="error" class="error">
      {{ error }}
      <button v-if="status === 'stopped-error'" @click="emit('gotoDemo')">Перейти в демо</button>
    </p>
  </section>
</template>

<style scoped>
.controls { display: flex; flex-direction: column; gap: 8px; }
label { display: flex; flex-direction: column; font-size: 13px; }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.error { color: #ff8a80; font-size: 13px; }
</style>
```

- [ ] **Step 2: Findings.vue**

`src/ui/Findings.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue';
import { GRADE_LABEL, LETTER_CHAR, type Letter, type LetterKind, type Word } from '../detect/types';

const props = defineProps<{ words: Word[]; letters: Letter[] }>();
const emit = defineEmits<{ select: [word: Word] }>();

const best = computed(() => props.words[0] ?? null);
const counts = computed(() => {
  const c: Record<LetterKind, number> = { X: 0, U: 0, I: 0 };
  for (const l of props.letters) c[l.kind]++;
  return c;
});
</script>

<template>
  <section class="findings">
    <h2>Находки</h2>

    <div v-if="best" class="best" :class="best.grade" @click="emit('select', best)">
      <div class="text">{{ best.text }}</div>
      <div class="bar"><div class="fill" :style="{ width: best.score + '%' }" /></div>
      <div class="meta">{{ best.score }}% · {{ GRADE_LABEL[best.grade] }}</div>
    </div>
    <p v-else class="empty">Слов пока нет. Ждём, пока самолёты долетят.</p>

    <ul v-if="words.length > 1" class="list">
      <li v-for="w in words.slice(1)" :key="w.key" :class="w.grade" @click="emit('select', w)">
        <span class="text">{{ w.text }}</span>
        <span class="bar"><span class="fill" :style="{ width: w.score + '%' }" /></span>
        <span class="meta">{{ w.score }}%</span>
      </li>
    </ul>

    <p class="counts">
      <span v-for="kind in (['X', 'U', 'I'] as LetterKind[])" :key="kind">{{ LETTER_CHAR[kind] }} — {{ counts[kind] }}</span>
    </p>
  </section>
</template>

<style scoped>
.findings { display: flex; flex-direction: column; gap: 8px; }
.best { cursor: pointer; padding: 8px; border: 1px solid #444; border-radius: 6px; }
.best .text { font-size: 28px; font-weight: bold; }
.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.list li { display: grid; grid-template-columns: 3em 1fr 3em; gap: 6px; align-items: center; cursor: pointer; font-size: 13px; }
.bar { display: block; height: 6px; background: #333; border-radius: 3px; overflow: hidden; }
.fill { display: block; height: 100%; background: currentColor; }
.perfect { color: #ff1744; }
.good { color: #ff9100; }
.crooked { color: #b39ddb; }
.anagram { color: #9e9e9e; }
.meta, .empty, .counts { font-size: 13px; color: #bbb; }
.counts { display: flex; gap: 12px; }
</style>
```

- [ ] **Step 3: App.vue**

`src/App.vue`:
```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import MapView from './map/MapView.vue';
import Controls from './ui/Controls.vue';
import Findings from './ui/Findings.vue';
import { MockSource } from './data/MockSource';
import { Fr24Source } from './data/Fr24Source';
import type { Bounds, FlightSource } from './data/FlightSource';
import type { LetterKind, Word } from './detect/types';
import { useScanner } from './composables/useScanner';

const apiKey = (import.meta.env.VITE_FR24_KEY as string | undefined) ?? '';
const hasKey = apiKey.length > 0;

const mock = new MockSource(Date.now() % 100_000, 60);
const api: FlightSource | null = hasKey ? new Fr24Source(apiKey) : null;

const mode = ref<'mock' | 'api'>('mock');
const intervalMs = ref(5000);
const sensitivity = ref(0);
const bounds = ref<Bounds | null>(null);
const mapView = ref<InstanceType<typeof MapView> | null>(null);

const source = computed<FlightSource>(() => (mode.value === 'api' && api ? api : mock));

const scanner = useScanner({
  source,
  getBounds: () => bounds.value,
  intervalMs,
  sensitivity,
});

watch(mode, (m) => {
  scanner.stop();
  scanner.reset();
  intervalMs.value = m === 'api' ? 20_000 : 5000;
  scanner.start();
});

function onBounds(b: Bounds): void {
  const first = bounds.value === null;
  bounds.value = b;
  if (first) scanner.start();
}

function plantLetter(kind: LetterKind): void {
  mock.plantLetter(kind);
}

function plantWord(): void {
  mock.plantWord();
}

function gotoDemo(): void {
  mode.value = 'mock';
}

function selectWord(w: Word): void {
  const a = scanner.analysis.value;
  if (!a) return;
  const ll = a.projection.toLatLon(w.center);
  mapView.value?.flyTo(ll.lon, ll.lat);
}

const words = computed(() => scanner.analysis.value?.words ?? []);
const letters = computed(() => scanner.analysis.value?.letters ?? []);
</script>

<template>
  <div class="app">
    <MapView ref="mapView" :analysis="scanner.analysis.value" :tracks="scanner.tracks.value" @bounds="onBounds" />
    <aside class="panel">
      <Controls
        v-model:mode="mode"
        v-model:interval-ms="intervalMs"
        v-model:sensitivity="sensitivity"
        :has-key="hasKey"
        :status="scanner.status.value"
        :error="scanner.error.value"
        @plant-letter="plantLetter"
        @plant-word="plantWord"
        @start="scanner.start"
        @stop="scanner.stop"
        @goto-demo="gotoDemo"
      />
      <Findings :words="words" :letters="letters" @select="selectWord" />
    </aside>
  </div>
</template>

<style>
html, body, #app { margin: 0; height: 100%; background: #111; color: #eee; font-family: system-ui, sans-serif; }
</style>

<style scoped>
.app { position: relative; height: 100%; }
.panel {
  position: absolute; top: 12px; left: 12px; width: 280px; max-height: calc(100% - 24px); overflow: auto;
  padding: 12px; background: rgba(20, 20, 20, 0.9); border-radius: 8px; display: flex; flex-direction: column; gap: 16px;
}
</style>
```

- [ ] **Step 4: Типы, тесты, сборка**

Run: `npm run typecheck && npm test && npm run build`
Expected: всё зелёное, `dist/` собран.

- [ ] **Step 5: Ручная проверка в браузере**

Run: `npm run dev` и открыть адрес из вывода.
Проверить по списку:
1. Карта загрузилась, панель слева видна, статус «Стоп» (значит опрос идёт).
2. Через 10–15 секунд появились серые линии треков, они растут.
3. Кнопка «Х» — через 1–2 минуты на карте подсвечен красный крест с подписью «Х NN%», счётчик Х вырос.
4. Кнопка «Й» — три голубых штриха и дужка сверху.
5. Кнопка «Слово» — через 2–3 минуты в панели появилось лучшее слово с полоской и уровнем; клик по нему перелетает к слову; на карте прямоугольник и подпись «ХУЙ NN%».
6. Сдвинуть карту далеко — треки пропадают через 10 минут, новые рейсы появляются сразу.
7. Ползунок чувствительности вправо — букв становится больше, влево — меньше, без перезапроса.
8. В селекте источник «Flightradar24 API — нет ключа» недоступен (без `.env`).

Если что-то не так — исправлять в соответствующем модуле, прогонять `npm test`, повторять проверку.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: wire map, controls and findings panel"
```

---

## Порядок и зависимости

Задачи 2–4 независимы друг от друга после Task 1. Задачи 5–8 идут по порядку (8 зависит от типов 5). Task 9 независима от 5–8. Task 10 зависит от 5–9. Task 11 → 12. Task 13 независима. Task 14 зависит от 10, 13. Task 15 зависит от 8, 9. Task 16 зависит от 15. Task 17 зависит от всего.

## Что не покрыто планом намеренно

Оформление, прогноз трека по курсу, история находок, сохранение между перезагрузками, Web Worker — вне первой итерации по спеке.
