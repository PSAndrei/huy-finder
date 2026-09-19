import { describe, it, expect } from 'vitest';
import { filterAnalysis, sameIds, wordTrackIds } from './focus';
import { seg } from './testUtils';
import { makeProjection } from '../geometry/project';
import type { Analysis } from './analyze';
import type { Letter, Word } from './types';

const x: Letter = { kind: 'X', score: 87, center: { x: 0, y: 0 }, up: null, size: 1000, key: 'x',
  segments: [seg(-500, -500, 500, 500, 'mock-1'), seg(-500, 500, 500, -500, 'mock-2')] };
const u: Letter = { kind: 'U', score: 70, center: { x: 1300, y: 0 }, up: { x: 0, y: 1 }, size: 1000, key: 'u',
  segments: [seg(1000, -500, 1600, 500, 'mock-3'), seg(1000, 500, 1300, 0, 'mock-3')] };
const i: Letter = { kind: 'I', score: 95, center: { x: 2600, y: 0 }, up: { x: 0, y: 1 }, size: 1000, key: 'i',
  segments: [seg(2200, -500, 2200, 500, 'mock-5'), seg(3000, -500, 3000, 500, 'mock-6'), seg(2200, -500, 3000, 500, 'mock-7')] };
// чужая Х: один отрезок общий с нашей У, второй — чужого борта
const otherX: Letter = { kind: 'X', score: 50, center: { x: 1200, y: 100 }, up: null, size: 900, key: 'ox',
  segments: [seg(1000, -500, 1600, 500, 'mock-3'), seg(1000, 500, 1600, -500, 'mock-9')] };
const word: Word = { letters: [x, u, i], text: 'ХУЙ', correctOrder: true, score: 78, grade: 'good', center: { x: 1300, y: 0 }, up: { x: 0, y: 1 }, key: 'x|u|i' };
const otherWord: Word = { ...word, letters: [otherX, u, i], key: 'ox|u|i', score: 60 };
const analysis: Analysis = { projection: makeProjection({ lat: 55, lon: 37 }), segmentCount: 8, letters: [x, u, i, otherX], words: [word, otherWord] };

describe('wordTrackIds', () => {
  it('собирает борта всех отрезков трёх букв без повторов', () => {
    expect([...wordTrackIds(word)].sort()).toEqual(['mock-1', 'mock-2', 'mock-3', 'mock-5', 'mock-6', 'mock-7']);
  });
});

describe('filterAnalysis', () => {
  it('оставляет буквы и слова, целиком нарисованные бортами из набора', () => {
    const f = filterAnalysis(analysis, wordTrackIds(word));
    expect(f.letters.map((l) => l.key)).toEqual(['x', 'u', 'i']);
    expect(f.words.map((w) => w.key)).toEqual(['x|u|i']);
    expect(f.projection).toBe(analysis.projection);
    expect(f.segmentCount).toBe(analysis.segmentCount);
  });

  it('пустой набор скрывает всё', () => {
    const f = filterAnalysis(analysis, new Set());
    expect(f.letters).toEqual([]);
    expect(f.words).toEqual([]);
  });
});

describe('sameIds', () => {
  it('равны только при одинаковом составе; null не равен ничему', () => {
    expect(sameIds(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true);
    expect(sameIds(new Set(['a', 'b']), new Set(['a']))).toBe(false);
    expect(sameIds(new Set(['a']), null)).toBe(false);
  });
});
