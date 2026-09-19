export type Airport = { iata: string; city: string };

/** Легенда рейса: что показываем в карточке. */
export type FlightInfo = {
  callsign: string;   // 'SVR1343'
  airline: string;    // 'Ural Airlines'
  aircraft: string;   // 'A321'
  from: Airport;
  to: Airport;
};

export type Position = {
  id: string;
  lat: number;
  lon: number;
  heading: number;   // градусы по часовой от севера
  timestamp: number; // мс
  speedKmh: number;
  info?: FlightInfo; // у FR24 light и в тестах может отсутствовать
};

export type Bounds = { north: number; south: number; west: number; east: number };

export interface FlightSource {
  fetchPositions(bounds: Bounds, now: number): Promise<Position[]>;
}
