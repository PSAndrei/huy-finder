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
