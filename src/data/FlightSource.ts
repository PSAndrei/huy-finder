export type Position = {
  id: string;
  lat: number;
  lon: number;
  heading: number;   // градусы по часовой от севера
  timestamp: number; // мс
};

export type Bounds = { north: number; south: number; west: number; east: number };

export interface FlightSource {
  fetchPositions(bounds: Bounds, now: number): Promise<Position[]>;
}
