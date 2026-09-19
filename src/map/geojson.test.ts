import { describe, it, expect } from 'vitest';
import { lettersToGeoJson, planesToGeoJson, tracksToGeoJson, wordsToGeoJson } from './geojson';
import { makeProjection } from '../geometry/project';
import type { Letter, Word } from '../detect/types';
import { seg } from '../detect/testUtils';

const proj = makeProjection({ lat: 55, lon: 37 });

describe('geojson', () => {
  it('треки — по LineString на трек, точки как [lon, lat]', () => {
    const fc = tracksToGeoJson([{ id: 'a', points: [{ lat: 55, lon: 37 }, { lat: 56, lon: 38 }], lastSeen: 0, heading: 0 }]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry).toEqual({ type: 'LineString', coordinates: [[37, 55], [38, 56]] });
    expect(fc.features[0].properties).toEqual({ id: 'a' });
  });

  it('самолёты — точка в конце трека с курсом', () => {
    const fc = planesToGeoJson([
      { id: 'a', points: [{ lat: 55, lon: 37 }, { lat: 56, lon: 38 }], lastSeen: 0, heading: 45 },
      { id: 'b', points: [{ lat: 50, lon: 30 }], lastSeen: 0, heading: 270 },
    ]);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].geometry).toEqual({ type: 'Point', coordinates: [38, 56] });
    expect(fc.features[0].properties).toEqual({ id: 'a', heading: 45 });
    expect(fc.features[1].geometry).toEqual({ type: 'Point', coordinates: [30, 50] });
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
