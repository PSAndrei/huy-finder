import { describe, it, expect } from 'vitest';
import { makeProjection, pointAhead } from './project';

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
