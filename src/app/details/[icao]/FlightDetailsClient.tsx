'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { FlightState, AircraftMetadata, FlightTrackPoint } from '@/types';
import { FlightFilters } from '@/components/ClientMap';
import { fetchLatestFlightState, fetchAircraftMetadata, fetchFlightTrack } from '@/app/actions';

const MapView = dynamic(() => import('@/components/MapView'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-800 flex items-center justify-center text-white">Loading map...</div>
});

interface FlightDetailsClientProps {
    icao: string;
}

// Function to get readable aircraft name from model code
const getReadableAircraftName = (model: string | null, manufacturer?: string | null): string => {
  if (!model) return 'Unknown Aircraft';
  
  // If we have both manufacturer and model, combine them
  if (manufacturer && manufacturer !== model) {
    return `${manufacturer} ${model}`;
  }
  
  // Otherwise return the model as is
  return model;
};

// Function to get short aircraft code from full name
const getShortAircraftCode = (fullName: string): string => {
  const name = fullName.toUpperCase();
  
  // Airbus
  if (name.includes('AIRBUS A318')) return 'A318';
  if (name.includes('AIRBUS A319')) return 'A319';
  if (name.includes('AIRBUS A320')) return 'A320';
  if (name.includes('AIRBUS A321')) return 'A321';
  if (name.includes('AIRBUS A330')) return 'A330';
  if (name.includes('AIRBUS A340')) return 'A340';
  if (name.includes('AIRBUS A350')) return 'A350';
  if (name.includes('AIRBUS A380')) return 'A380';
  
  // Boeing
  if (name.includes('BOEING 737-800')) return 'B738';
  if (name.includes('BOEING 737-900')) return 'B739';
  if (name.includes('BOEING 737')) return 'B737';
  if (name.includes('BOEING 747')) return 'B747';
  if (name.includes('BOEING 757')) return 'B757';
  if (name.includes('BOEING 767')) return 'B767';
  if (name.includes('BOEING 777')) return 'B777';
  if (name.includes('BOEING 787')) return 'B787';
  
  // Embraer
  if (name.includes('EMBRAER E170')) return 'E170';
  if (name.includes('EMBRAER E175')) return 'E175';
  if (name.includes('EMBRAER E190')) return 'E190';
  if (name.includes('EMBRAER E195')) return 'E195';
  if (name.includes('EMBRAER E175-E2')) return 'E275';
  if (name.includes('EMBRAER E190-E2')) return 'E290';
  if (name.includes('EMBRAER E195-E2')) return 'E295';
  
  // Bombardier
  if (name.includes('BOMBARDIER CRJ100')) return 'CRJ1';
  if (name.includes('BOMBARDIER CRJ200')) return 'CRJ2';
  if (name.includes('BOMBARDIER CRJ700')) return 'CRJ7';
  if (name.includes('BOMBARDIER CRJ900')) return 'CRJ9';
  if (name.includes('BOMBARDIER CRJ')) return 'CRJ';
  if (name.includes('BOMBARDIER DASH 8')) return 'DH8';
  
  // ATR
  if (name.includes('ATR 42')) return 'AT42';
  if (name.includes('ATR 72')) return 'AT72';
  if (name.includes('ATR')) return 'ATR';
  
  // Saab
  if (name.includes('SAAB 340')) return 'SB34';
  
  // Fokker
  if (name.includes('FOKKER')) return 'FOK';
  
  // McDonnell Douglas
  if (name.includes('MCDONNELL DOUGLAS MD-80')) return 'MD80';
  if (name.includes('MCDONNELL DOUGLAS MD-90')) return 'MD90';
  
  // Small aircraft - check for specific models first
  if (name.includes('CESSNA')) {
    if (name.includes('CESSNA 172')) return 'C172';
    if (name.includes('CESSNA 152')) return 'C152';
    if (name.includes('CESSNA 182')) return 'C182';
    if (name.includes('CESSNA 206')) return 'C206';
    if (name.includes('CESSNA 208')) return 'C208';
    return 'CESS';
  }
  if (name.includes('PIPER')) {
    if (name.includes('PIPER PA-28')) return 'PA28';
    if (name.includes('PIPER PA-32')) return 'PA32';
    if (name.includes('PIPER PA-44')) return 'PA44';
    return 'PIPE';
  }
  if (name.includes('BEECHCRAFT')) {
    if (name.includes('BEECHCRAFT BONANZA')) return 'BE36';
    if (name.includes('BEECHCRAFT BARON')) return 'BE58';
    if (name.includes('BEECHCRAFT KING AIR')) return 'BE20';
    return 'BEEC';
  }
  if (name.includes('CIRRUS')) {
    if (name.includes('CIRRUS SR20')) return 'SR20';
    if (name.includes('CIRRUS SR22')) return 'SR22';
    return 'CIRR';
  }
  if (name.includes('DIAMOND')) {
    if (name.includes('DIAMOND DA40')) return 'DA40';
    if (name.includes('DIAMOND DA42')) return 'DA42';
    if (name.includes('DIAMOND DA62')) return 'DA62';
    return 'DIAM';
  }
  if (name.includes('ROBIN')) return 'ROBI';
  
  // Helicopters
  if (name.includes('AIRBUS H125')) return 'H125';
  if (name.includes('AIRBUS H135')) return 'H135';
  if (name.includes('AIRBUS H145')) return 'H145';
  if (name.includes('AIRBUS H175')) return 'H175';
  if (name.includes('LEONARDO AW139')) return 'AW139';
  if (name.includes('LEONARDO AW169')) return 'AW169';
  if (name.includes('LEONARDO AW189')) return 'AW189';
  if (name.includes('HELICOPTER')) return 'HELI';
  
  // If no specific match, return first 4 characters of the model
  const words = fullName.split(' ');
  if (words.length > 1) {
    const lastWord = words[words.length - 1];
    if (lastWord.length >= 3) {
      return lastWord.substring(0, 4).toUpperCase();
    }
  }
  
  return fullName.substring(0, 4).toUpperCase(); // Return first 4 characters
};

export default function FlightDetailsClient({ icao }: FlightDetailsClientProps) {
    const [flight, setFlight] = useState<FlightState | null>(null);
    const [metadata, setMetadata] = useState<AircraftMetadata | null>(null);
    const [track, setTrack] = useState<FlightTrackPoint[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Main data fetching effect
    useEffect(() => {
        let isMounted = true;
        
        const fetchData = async () => {
            console.log('FlightDetailsClient: Fetching data for ICAO24:', icao);
            
            try {
                setIsLoading(true);
                setError(null);
                
                // Use Promise.all to fetch data concurrently
                const [flightData, trackData] = await Promise.all([
                    fetchLatestFlightState(icao),
                    fetchFlightTrack(icao)
                ]);
                
                if (!isMounted) return;
                
                // Fetch metadata after we have flight data
                let metadataData = null;
                if (flightData) {
                    // First try to get metadata with ICAO24
                    metadataData = await fetchAircraftMetadata(icao, flightData?.callsign || null, flightData?.callsign || null);
                    
                    if (!isMounted) return;
                    
                    // If no registration found, try with callsign as registration
                    if (!metadataData?.registration || metadataData.registration === 'Unknown') {
                        if (flightData?.callsign) {
                            console.log('FlightDetailsClient: No registration found, trying with callsign as registration');
                            metadataData = await fetchAircraftMetadata(icao, flightData.callsign, flightData.callsign);
                        }
                    }
                }
                
                if (!isMounted) return;
                
                console.log('FlightDetailsClient: Flight data:', flightData);
                console.log('FlightDetailsClient: Metadata:', metadataData);
                console.log('FlightDetailsClient: Metadata imageUrl:', metadataData?.imageUrl);
                console.log('FlightDetailsClient: Metadata photoUrl:', metadataData?.photoUrl);
                console.log('FlightDetailsClient: Track data:', trackData);
                
                setFlight(flightData);
                setMetadata(metadataData);
                setTrack(trackData);
                setIsLoading(false);
            } catch (error) {
                console.error('FlightDetailsClient: Error fetching data:', error);
                if (isMounted) {
                    setError('Failed to load flight data');
                    setIsLoading(false);
                }
            }
        };

        // Delay the initial fetch to avoid Suspense issues
        const timer = setTimeout(() => {
            fetchData();
        }, 100);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [icao]);

    // Separate effect for periodic updates
    useEffect(() => {
        if (!flight) return; // Only start interval if we have flight data
        
        let isMounted = true;
        
        const intervalId = setInterval(async () => {
            if (!isMounted) return;
            
            try {
                const [flightData, trackData] = await Promise.all([
                    fetchLatestFlightState(icao),
                    fetchFlightTrack(icao)
                ]);
                
                if (isMounted) {
                    if (flightData) setFlight(flightData);
                    if (trackData) setTrack(trackData);
                }
            } catch (error) {
                console.error('FlightDetailsClient: Error in interval:', error);
            }
        }, 10000); // REFRESH RATE SET TO 10 SECONDS

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [icao, flight]);

    if (isLoading) {
        return <div className="h-screen w-full bg-gray-900 flex items-center justify-center text-white">Loading flight details...</div>;
    }

    if (error) {
        return (
            <div className="h-screen w-full bg-gray-900 flex items-center justify-center text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Error</h1>
                    <p className="text-lg mb-6">{error}</p>
                    <Link href="/" className="inline-block bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-500 transition-colors">
                        &larr; Back to Map
                    </Link>
                </div>
            </div>
        );
    }

    if (!flight) {
        // Fallback: jeśli nie ma aktywnego lotu, ale mamy metadane z rejestracji
        if (metadata && metadata.registration && metadata.registration !== 'Unknown') {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
                    <div className="text-center max-w-2xl mx-auto p-8">
                        <h1 className="text-3xl font-bold mb-4">Aircraft Information</h1>
                        <p className="text-xl mb-6">This aircraft is not currently in flight, but we have registration data.</p>
                        
                        <div className="bg-gray-800 rounded-lg p-6 mb-6">
                            <h2 className="text-2xl font-bold mb-4">Registration: {metadata.registration}</h2>
                            {metadata.model && (
                                <p className="text-lg text-gray-300 mb-2">
                                    Model: {getReadableAircraftName(metadata.model, metadata.manufacturer)}
                                </p>
                            )}
                            
                            {/* Aircraft Image */}
                            {metadata.photoUrl && metadata.photoUrl.trim() !== '' && (
                                <div className="mt-4">
                                    <img 
                                        src={metadata.photoUrl} 
                                        alt={`Aircraft ${metadata.registration}`}
                                        className="w-full max-w-md mx-auto h-64 object-cover rounded-lg shadow-lg"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        
                        <Link href="/" className="inline-block bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-500 transition-colors">
                            &larr; Back to Map
                        </Link>
                    </div>
                </div>
            );
        }
        
        return (
             <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
                <div className="text-center">
                    <h1 className="text-4xl font-bold">404</h1>
                    <p className="text-xl mt-2">Flight not found.</p>
                    <p className="text-sm text-gray-400 mt-2">This aircraft may not be currently in flight or the ICAO24 code may be incorrect.</p>
                    <Link href="/" className="mt-6 inline-block bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-500 transition-colors">
                        &larr; Back to Map
                    </Link>
                </div>
            </div>
        );
    }

    const center: [number, number] = [flight.latitude, flight.longitude];

    // Default flight filters for details page
    const defaultFilters: FlightFilters = {
        hideOnGround: false,
        category: 'all',
        minAltitude: 0,
        showLabels: true,
        showAirlineLogos: true,
        showFlightNumbers: true,
        showAltitude: true,
        showSpeed: true,
        autoFetchAircraftInfo: false
    };

    return (
        <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white">
            <div className="md:w-2/3 h-1/2 md:h-full">
                <MapView
                    flights={[flight]}
                    airports={[]}
                    center={center}
                    zoom={8}
                    selectedTrack={track}
                    selectedFlightIcao={flight.icao24}
                    isPopupOpen={false} // Popup is not needed on details page
                    isFlightDetailsLoading={false}
                    selectedFlightRoute={null}
                    flightFilters={defaultFilters}
                    onBoundsChange={() => {}}
                    onFlightClick={() => {}}
                    onPopupClose={() => {}}
                />
            </div>
            <div className="md:w-1/3 h-1/2 md:h-full p-4 sm:p-6 lg:p-8 overflow-y-auto">
                <div className="mb-6">
                    <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
                        &larr; Back to Map
                    </Link>
                </div>
                <div className="bg-gray-800 shadow-xl rounded-lg overflow-hidden">
                    <div className="p-6 border-b border-gray-700">
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">
                            {flight.callsign || 'Unknown Callsign'}
                        </h1>
                        <p className="text-md sm:text-lg text-gray-400 mt-1">
                            {metadata?.model ? getReadableAircraftName(metadata.model, metadata.manufacturer) : 'Unknown Model'} 
                            {metadata?.model && (
                                <span className="text-sm text-purple-400 ml-2">
                                    ({getShortAircraftCode(getReadableAircraftName(metadata.model, metadata.manufacturer))})
                                </span>
                            )}
                        </p>
                        {metadata?.registration && (
                            <p className="text-sm text-gray-500 mt-1">
                                Registration: {metadata.registration}
                            </p>
                        )}
                        {metadata?.manufacturer && (
                            <p className="text-sm text-gray-500 mt-1">
                                Manufacturer: {metadata.manufacturer}
                            </p>
                        )}
                        {metadata?.owner && (
                            <p className="text-sm text-gray-500 mt-1">
                                Owner: {metadata.owner}
                            </p>
                        )}
                        {metadata?.operator && (
                            <p className="text-sm text-gray-500 mt-1">
                                Operator: {metadata.operator}
                            </p>
                        )}
                        {metadata?.yearBuilt && (
                            <p className="text-sm text-gray-500 mt-1">
                                Year Built: {metadata.yearBuilt}
                            </p>
                        )}
                        {metadata?.engineType && (
                            <p className="text-sm text-gray-500 mt-1">
                                Engine Type: {metadata.engineType}
                            </p>
                        )}
                        
                        {/* Aircraft Image */}
                        {(metadata?.photoUrl && metadata.photoUrl.trim() !== '') ? (
                            <div className="mt-4">
                                {(() => { console.log('FlightDetailsClient: Rendering photoUrl:', metadata.photoUrl); return null; })()}
                                <img 
                                    src={metadata.photoUrl} 
                                    alt={`Aircraft ${metadata.registration || 'photo'}`}
                                    className="w-full h-48 object-cover rounded-lg shadow-lg"
                                    onError={(e) => {
                                        console.error('FlightDetailsClient: Image load error:', e);
                                        e.currentTarget.style.display = 'none';
                                    }}
                                    onLoad={() => {
                                        console.log('FlightDetailsClient: Image loaded successfully');
                                    }}
                                />
                            </div>
                        ) : (metadata?.imageUrl && metadata.imageUrl.trim() !== '' && (
                            <div className="mt-4">
                                {(() => { console.log('FlightDetailsClient: Rendering imageUrl:', metadata.imageUrl); return null; })()}
                                <img 
                                    src={metadata.imageUrl} 
                                    alt={`Aircraft ${metadata.registration || 'photo'}`}
                                    className="w-full h-48 object-cover rounded-lg shadow-lg"
                                    onError={(e) => {
                                        console.error('FlightDetailsClient: Image load error:', e);
                                        e.currentTarget.style.display = 'none';
                                    }}
                                    onLoad={() => {
                                        console.log('FlightDetailsClient: Image loaded successfully');
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-6 p-6">
                        <div className="flex flex-col">
                            <p className="text-sm text-gray-400 uppercase tracking-wider">Altitude</p>
                            <p className="text-xl font-semibold text-white mt-1">
                                {flight.baro_altitude ? `${(flight.baro_altitude * 3.28084).toFixed(0)} ft` : 'N/A'}
                            </p>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-sm text-gray-400 uppercase tracking-wider">Speed</p>
                            <p className="text-xl font-semibold text-white mt-1">
                                {flight.velocity ? `${(flight.velocity * 1.94384).toFixed(0)} kt` : 'N/A'}
                            </p>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-sm text-gray-400 uppercase tracking-wider">V/S</p>
                            <p className="text-xl font-semibold text-white mt-1">
                                {flight.vertical_rate ? `${(flight.vertical_rate * 196.85).toFixed(0)} ft/min` : 'N/A'}
                            </p>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-sm text-gray-400 uppercase tracking-wider">Aircraft Origin</p>
                            <div className="flex items-center mt-1">
                                {flight.origin_country_code && (
                                    <img 
                                        src={`https://flagcdn.com/w40/${flight.origin_country_code.toLowerCase()}.png`} 
                                        alt={`${flight.origin_country} flag`}
                                        className="w-6 h-auto mr-2 rounded-sm"
                                    />
                                )}
                                <p className="text-xl font-semibold text-white">{flight.origin_country}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}