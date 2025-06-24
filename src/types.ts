export interface FlightState {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  origin_country_code: string;
  time_position: number | null;
  last_contact: number;
  longitude: number;
  latitude: number;
  baro_altitude: number | null;
  on_ground: boolean;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  sensors: number[] | null;
  geo_altitude: number | null;
  squawk: string | null;
  spi: boolean;
  position_source: number;
  category: number;
}

export interface BoundingBox {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}

export interface Airport {
  icao: string;
  iata: string | null;
  name: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
}

export type AirportFilterType = 'all' | 'main';

export interface FlightTrackPoint {
  time: number;
  latitude: number;
  longitude: number;
  baro_altitude: number | null;
  true_track: number | null;
  on_ground: boolean;
  velocity: number | null;
  vertical_rate: number | null;
  callsign?: string;
}

export interface FlightRouteInfo {
  departureAirport: string | null;
  arrivalAirport: string | null;
}

export interface AircraftMetadata {
  model: string | null;
  registration: string | null;
  imageUrl?: string | null;
  manufacturer?: string | null;
  owner?: string | null;
  operator?: string | null;
  yearBuilt?: string | null;
  engineType?: string | null;
  photoUrl?: string | null;
}
