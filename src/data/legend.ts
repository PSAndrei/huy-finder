import type { Airport, FlightInfo } from './FlightSource';

/** Реальные авиакомпании и их позывные-префиксы. */
export const AIRLINES: { name: string; prefix: string }[] = [
  { name: 'Aeroflot', prefix: 'AFL' }, { name: 'S7 Airlines', prefix: 'SBI' },
  { name: 'Ural Airlines', prefix: 'SVR' }, { name: 'Pobeda', prefix: 'PBD' },
  { name: 'UTair', prefix: 'UTA' }, { name: 'Rossiya', prefix: 'SDM' },
  { name: 'Nordwind', prefix: 'NWS' }, { name: 'Azur Air', prefix: 'AZV' },
  { name: 'Turkish Airlines', prefix: 'THY' }, { name: 'Emirates', prefix: 'UAE' },
  { name: 'Belavia', prefix: 'BRU' }, { name: 'Air Astana', prefix: 'KZR' },
];

export const AIRCRAFT = ['A320', 'A321', 'A319', 'B737', 'B738', 'B77W', 'A350', 'SU95'];

export const AIRPORTS: Airport[] = [
  { iata: 'SVO', city: 'Moscow' }, { iata: 'DME', city: 'Moscow' }, { iata: 'VKO', city: 'Moscow' },
  { iata: 'LED', city: 'Saint Petersburg' }, { iata: 'KZN', city: 'Kazan' }, { iata: 'SVX', city: 'Yekaterinburg' },
  { iata: 'AER', city: 'Sochi' }, { iata: 'KRR', city: 'Krasnodar' }, { iata: 'MCX', city: 'Makhachkala' },
  { iata: 'UFA', city: 'Ufa' }, { iata: 'KUF', city: 'Samara' }, { iata: 'ROV', city: 'Rostov-on-Don' },
  { iata: 'GOJ', city: 'Nizhny Novgorod' }, { iata: 'OVB', city: 'Novosibirsk' }, { iata: 'MRV', city: 'Mineralnye Vody' },
  { iata: 'IST', city: 'Istanbul' }, { iata: 'DXB', city: 'Dubai' }, { iata: 'MSQ', city: 'Minsk' },
  { iata: 'ALA', city: 'Almaty' }, { iata: 'TAS', city: 'Tashkent' },
];

function index(rng: () => number, n: number): number {
  return Math.floor(rng() * n);
}

/** Выдуманная, но правдоподобная легенда. Одно зерно rng — одна легенда. */
export function makeFlightInfo(rng: () => number): FlightInfo {
  const airline = AIRLINES[index(rng, AIRLINES.length)];
  const aircraft = AIRCRAFT[index(rng, AIRCRAFT.length)];
  const fromIdx = index(rng, AIRPORTS.length);
  const toIdx = (fromIdx + 1 + index(rng, AIRPORTS.length - 1)) % AIRPORTS.length; // всегда другой аэропорт
  const number = 100 + index(rng, 9900);
  return {
    callsign: `${airline.prefix}${number}`,
    airline: airline.name,
    aircraft,
    from: AIRPORTS[fromIdx],
    to: AIRPORTS[toIdx],
  };
}

/** Имя авиакомпании по префиксу позывного; неизвестный префикс возвращается как есть. */
export function airlineName(prefix: string): string {
  return AIRLINES.find((a) => a.prefix === prefix)?.name ?? prefix;
}
