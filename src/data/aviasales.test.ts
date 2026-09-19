import { describe, expect, it } from 'vitest';
import { aviasalesUrl } from './aviasales';
import type { FlightInfo } from './FlightSource';

const info: FlightInfo = {
  callsign: 'SVR1343', airline: 'Ural Airlines', aircraft: 'A321',
  from: { iata: 'SVO', city: 'Moscow' }, to: { iata: 'DXB', city: 'Dubai' },
};

describe('aviasalesUrl', () => {
  it('строит поиск по направлению на дату через неделю', () => {
    const today = new Date(2026, 8, 19); // 19 сентября
    expect(aviasalesUrl(info, today)).toBe('https://www.aviasales.ru/search/SVO2609DXB1');
  });

  it('дополняет день и месяц нулями', () => {
    const today = new Date(2026, 11, 28); // 28 декабря → 4 января
    expect(aviasalesUrl(info, today)).toBe('https://www.aviasales.ru/search/SVO0401DXB1');
  });

  it('без легенды ведёт на форму поиска', () => {
    expect(aviasalesUrl(null, new Date())).toBe('https://www.aviasales.ru/');
  });
});
