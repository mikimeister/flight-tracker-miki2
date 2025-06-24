'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
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

export default function ClientMap() {
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
  const [isPopupOpen, setIsPopupOpen] = useState(false); // NEW STATE for popup visibility
  const [isFlightDetailsLoading, setIsFlightDetailsLoading] = useState(false);

  const selectedIcaoRef = useRef<string | null>(null);
  useEffect(() => {
      selectedIcaoRef.current = selectedFlightIcao;
  }, [selectedFlightIcao]);

  const handleBoundsChange = useCallback((newBounds: BoundingBox) => {
    const boundsChanged = JSON.stringify(newBounds) !== JSON.stringify(currentBounds);
    if (boundsChanged) {
      setCurrentBounds(newBounds);
    }
  }, [currentBounds]);

  const handleFlightClick = useCallback(async (flight: FlightState) => {
    const icao24 = flight.icao24;
    
    setIsFlightDetailsLoading(true);
    setSelectedFlightIcao(icao24);
    setIsPopupOpen(true); // Always open popup
    setSelectedTrack(null);
    setSelectedFlightRoute(null);

    const [trackData, routeData] = await Promise.all([
        fetchFlightTrack(icao24),
        fetchFlightPlan(icao24, flight.callsign)
    ]);

    if (selectedIcaoRef.current === icao24) {
        setSelectedTrack(trackData);
        setSelectedFlightRoute(routeData);
    }
    
    setIsFlightDetailsLoading(false);
  }, []); 

  const handlePopupClose = useCallback(() => {
    setIsPopupOpen(false); // ONLY close popup, do not deselect flight
  }, []);

  // Effect for fetching data
  useEffect(() => {
    if (!currentBounds) return;
    let isMounted = true;
    const refreshFlightData = async () => {
      const flightData = await fetchAllFlights(currentBounds);
      if (isMounted) setAllFlights(flightData);
    };
    const fetchAllData = async () => {
      setIsLoading(true);
      const [flightData, airportData] = await Promise.all([
        fetchAllFlights(currentBounds),
        fetchAirports(currentBounds, airportFilter),
      ]);
      if (isMounted) {
        setAllFlights(flightData);
        setAirports(airportData);
        setIsLoading(false);
      }
    };
    fetchAllData();
    const intervalId = setInterval(refreshFlightData, 60000); // 60 sekund
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [currentBounds, airportFilter]);

  // Effect for filtering flights
  useEffect(() => {
    let flightsToDisplay = [...allFlights];
    if (flightFilters.hideOnGround) {
      flightsToDisplay = flightsToDisplay.filter(flight => !flight.on_ground);
    }
    if (flightFilters.minAltitude > 0) {
      const minAltitudeInMeters = flightFilters.minAltitude * 0.3048;
      flightsToDisplay = flightsToDisplay.filter(flight => flight.baro_altitude != null && flight.baro_altitude >= minAltitudeInMeters);
    }
    setFilteredFlights(flightsToDisplay);
  }, [allFlights, flightFilters]);

  // Effect for initial centering
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => setCenter([position.coords.latitude, position.coords.longitude]),
      () => console.log("Geolocation permission denied.")
    );
  }, []);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      {isLoading && <div style={{position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(255, 255, 255, 0.8)', padding: '5px 15px', borderRadius: '5px' }}>Loading data...</div> }
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
        onPopupClose={handlePopupClose}
        selectedTrack={selectedTrack}
        selectedFlightIcao={selectedFlightIcao}
        isPopupOpen={isPopupOpen} // Pass new state
        selectedFlightRoute={selectedFlightRoute}
        isFlightDetailsLoading={isFlightDetailsLoading}
        flightFilters={flightFilters}
      />
    </div>
  );
}