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
