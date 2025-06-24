'use client'

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { fetchAllFlights, fetchAirports, fetchFlightTrack, fetchFlightPlan } from '../app/actions';
import { FlightState, BoundingBox, Airport, AirportFilterType, FlightTrackPoint, FlightRouteInfo } from '../types';
import FilterPanel from './FilterPanel';

const MapView = dynamic(() => import('./MapView'), { 
  ssr: false,
  loading: () => <div className="h-screen w-full bg-gray-200 flex items-center justify-center"><p>Loading Map...</p></div>
});

export interface FlightFilters {
  hideOnGround: boolean;
  category: string;
  minAltitude: number;
  showLabels: boolean;
  showAirlineLogos: boolean;
  showFlightNumbers: boolean;
  showAltitude: boolean;
  showSpeed: boolean;
  autoFetchAircraftInfo: boolean;
}

export default function GlobalFlightMap() {
  const router = useRouter();
  const [allFlights, setAllFlights] = useState<FlightState[]>([]);
  const [filteredFlights, setFilteredFlights] = useState<FlightState[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [center, setCenter] = useState<[number, number]>([52.237, 21.017]);
  const [isLoading, setIsLoading] = useState(true);
  const [airportFilter, setAirportFilter] = useState<AirportFilterType>('main');
  const [flightFilters, setFlightFilters] = useState<FlightFilters>({ 
    hideOnGround: true, 
    category: 'all',
    minAltitude: 0,
    showLabels: true,
    showAirlineLogos: true,
    showFlightNumbers: true,
    showAltitude: true,
    showSpeed: true,
    autoFetchAircraftInfo: false
  });
  const [currentBounds, setCurrentBounds] = useState<BoundingBox | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<FlightTrackPoint[] | null>(null);
  const [selectedFlightRoute, setSelectedFlightRoute] = useState<FlightRouteInfo | null>(null);
  const [selectedFlightIcao, setSelectedFlightIcao] = useState<string | null>(null);
  const [isFlightDetailsLoading, setIsFlightDetailsLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const handleBoundsChange = useCallback((newBounds: BoundingBox) => {
    const boundsChanged = JSON.stringify(newBounds) !== JSON.stringify(currentBounds);
    if (boundsChanged) {
      setCurrentBounds(newBounds);
      // Update map center based on bounds
      const centerLat = (newBounds.lamin + newBounds.lamax) / 2;
      const centerLng = (newBounds.lomin + newBounds.lomax) / 2;
      setMapCenter({ lat: centerLat, lng: centerLng });
    }
  }, [currentBounds]);

  const handleFlightClick = useCallback(async (flight: FlightState) => {
    const icao24 = flight.icao24;

    if (selectedFlightIcao === icao24) {
      setIsPopupOpen(prev => !prev);
      return;
    }
    
    setIsFlightDetailsLoading(true);
    setSelectedFlightIcao(icao24);
    setIsPopupOpen(true);
    setSelectedTrack(null);
    setSelectedFlightRoute(null);

    const [trackData, routeData] = await Promise.all([
      fetchFlightTrack(icao24),
      fetchFlightPlan(icao24, flight.callsign)
    ]);

    setSelectedTrack(trackData);
    setSelectedFlightRoute(routeData);
    setIsFlightDetailsLoading(false);
  }, [selectedFlightIcao]);

  const handlePopupClose = useCallback(() => {
    setIsPopupOpen(false);
  }, []);

  // Dodaję interwał odświeżania lotów na 10 sekund, jeśli nie istnieje
  useEffect(() => {
    if (!currentBounds) return;

    const fetchData = async () => {
      setIsLoading(true);
      
      const [flightData, airportData] = await Promise.all([
        fetchAllFlights(currentBounds),
        fetchAirports(currentBounds, airportFilter)
      ]);

      setAllFlights(flightData);
      setAirports(airportData);
      setIsLoading(false);
    };

    fetchData();
    const intervalId = setInterval(fetchData, 10000); // 10 sekund
    return () => clearInterval(intervalId);
  }, [currentBounds, airportFilter]);

  // Effect for filtering flights locally
  useEffect(() => {
    let flightsToDisplay = [...allFlights];

    if (flightFilters.hideOnGround) {
      flightsToDisplay = flightsToDisplay.filter(flight => !flight.on_ground);
    }

    setFilteredFlights(flightsToDisplay);
  }, [allFlights, flightFilters]);

  // Effect for initial centering
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter([position.coords.latitude, position.coords.longitude]);
      },
      () => {
        console.log("Geolocation permission denied. Using default center.");
      }
    );
  }, []);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.8)',
          padding: '5px 15px',
          borderRadius: '5px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        }}>
          Loading data...
        </div>
      )}
      <FilterPanel 
        airportFilter={airportFilter} 
        onAirportFilterChange={setAirportFilter} 
        flightFilters={flightFilters} 
        onFlightFilterChange={setFlightFilters} 
      />
      <MapView 
        flights={filteredFlights} 
        airports={airports}
        center={center} 
        onBoundsChange={handleBoundsChange} 
        onFlightClick={handleFlightClick}
        selectedTrack={selectedTrack}
        selectedFlightIcao={selectedFlightIcao}
        selectedFlightRoute={selectedFlightRoute}
        isFlightDetailsLoading={isFlightDetailsLoading}
        isPopupOpen={isPopupOpen}
        onPopupClose={handlePopupClose}
        flightFilters={flightFilters}
        mapCenter={mapCenter}
      />
    </div>
  );
} 