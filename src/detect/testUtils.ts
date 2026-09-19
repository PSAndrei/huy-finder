import type { Segment } from '../geometry/segments';

let counter = 0;

/** Отрезок для тестов. trackId по умолчанию уникальный. */
export function seg(ax: number, ay: number, bx: number, by: number, trackId?: string): Segment {
  const tid = trackId ?? `t${counter++}`;
  return { id: `${tid}#${counter++}`, trackId: tid, a: { x: ax, y: ay }, b: { x: bx, y: by } };
}
