export type LatLon = { lat: number; lon: number };
export type Pt = { x: number; y: number };

export type Projection = {
  center: LatLon;
  toXY(p: LatLon): Pt;
  toLatLon(p: Pt): LatLon;
};

const EARTH_RADIUS_M = 6_371_000;
export const DEG = Math.PI / 180;

/** Равнопромежуточная проекция вокруг центра: метры на восток (x) и на север (y). */
export function makeProjection(center: LatLon): Projection {
  const cosLat = Math.cos(center.lat * DEG);
  return {
    center,
    toXY(p) {
      return {
        x: (p.lon - center.lon) * DEG * EARTH_RADIUS_M * cosLat,
        y: (p.lat - center.lat) * DEG * EARTH_RADIUS_M,
      };
    },
    toLatLon(p) {
      return {
        lat: center.lat + p.y / EARTH_RADIUS_M / DEG,
        lon: center.lon + p.x / (EARTH_RADIUS_M * cosLat) / DEG,
      };
    },
  };
}

const KM_PER_DEG = 111.32;

/** Точка в km по курсу headingDeg (по часовой от севера). Долгота масштабируется по новой широте. */
export function pointAhead(p: LatLon, headingDeg: number, km: number): LatLon {
  const h = headingDeg * DEG;
  const lat = p.lat + (km * Math.cos(h)) / KM_PER_DEG;
  const lon = p.lon + (km * Math.sin(h)) / (KM_PER_DEG * Math.cos(lat * DEG));
  return { lat, lon };
}
