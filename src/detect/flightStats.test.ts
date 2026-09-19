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
const word: Word = { letters: [x, u, i], text: 'ХУЙ', correctOrder: true, score: 78, grade: 'good', center: { x: 1300, y: 0 }, up: { x: 0, y: 1 }, key: 'x|u|i' };
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
