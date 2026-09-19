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

export type PlaneMarker = { id: string; lat: number; lon: number; heading: number; selected: boolean };

/** Самолёты: точка с курсом (для поворота иконки) и флагом выбора (для цвета). */
export function planesToGeoJson(planes: PlaneMarker[]): FeatureCollection {
  return fc(planes.map((p) => point([p.lon, p.lat], { id: p.id, heading: p.heading, selected: p.selected })));
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
