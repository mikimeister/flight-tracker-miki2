import React from 'react';
import Link from 'next/link';
import { FlightState, FlightRouteInfo } from '../types';
import airlineData from '../data/airline-codes-map.json';

interface FlightDetailsPanelProps {
  selectedFlight: FlightState;
  selectedFlightRoute: FlightRouteInfo | null;
  aircraftMetadata: { 
    model: string | null, 
    registration: string | null,
    manufacturer: string | null,
    owner: string | null,
    operator: string | null,
    yearBuilt: string | null,
    engineType: string | null,
    photoUrl: string | null,
  } | null;
}

// Re-structure the airline data for efficient lookup
const icaoToNameMap = new Map<string, string>();
for (const key in airlineData) {
    const airline = (airlineData as any)[key];
    if (airline.icao) {
        icaoToNameMap.set(airline.icao.toUpperCase(), airline.name);
    }
}

const getAirlineName = (callsign: string | null): string => {
  if (!callsign) return 'N/A';
  // The first 3 letters of a callsign are usually the airline's ICAO code
  const icao = callsign.substring(0, 3).toUpperCase();
  return icaoToNameMap.get(icao) || 'Private or Unknown';
};

const FlightDetailsPanel: React.FC<FlightDetailsPanelProps> = ({ selectedFlight, selectedFlightRoute, aircraftMetadata }) => {
  const callsign = selectedFlight.callsign?.trim() || 'N/A';
  const airlineName = getAirlineName(callsign);
  const onGround = selectedFlight.on_ground;
  const velocity = selectedFlight.velocity ? `${Math.round(selectedFlight.velocity * 1.94384)} kt` : 'N/A';
  const altitude = selectedFlight.baro_altitude ? `${Math.round(selectedFlight.baro_altitude * 3.28084)} ft` : 'N/A';
  const originCountry = selectedFlight.origin_country;

  return (
    <div className="space-y-4 text-sm">
      <div className="mb-4">
        <Link href="/" className="text-blue-500 hover:underline">
          &larr; Back to Map
        </Link>
      </div>

      <div>
        <h3 className="font-bold text-xl">{callsign}</h3>
        <p className="text-gray-600">{airlineName}</p>
      </div>

      {aircraftMetadata && (
        <div>
          <p><strong className="font-semibold">Model:</strong> {aircraftMetadata.model || 'N/A'}</p>
          <p><strong className="font-semibold">Registration:</strong> {aircraftMetadata.registration || 'N/A'}</p>
          {aircraftMetadata.manufacturer && (
            <p><strong className="font-semibold">Manufacturer:</strong> {aircraftMetadata.manufacturer}</p>
          )}
          {aircraftMetadata.owner && (
            <p><strong className="font-semibold">Owner:</strong> {aircraftMetadata.owner}</p>
          )}
          {aircraftMetadata.operator && (
            <p><strong className="font-semibold">Operator:</strong> {aircraftMetadata.operator}</p>
          )}
          {aircraftMetadata.yearBuilt && (
            <p><strong className="font-semibold">Year Built:</strong> {aircraftMetadata.yearBuilt}</p>
          )}
          {aircraftMetadata.engineType && (
            <p><strong className="font-semibold">Engine Type:</strong> {aircraftMetadata.engineType}</p>
          )}
          {aircraftMetadata.photoUrl && (
            <div className="mt-2">
              <img 
                src={aircraftMetadata.photoUrl} 
                alt="Aircraft" 
                className="w-full max-w-xs rounded-lg shadow-md"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      )}

      <hr />

      <div>
        <p><strong className="font-semibold">Status:</strong> {onGround ? 'On Ground' : 'In The Air'}</p>
        <p><strong className="font-semibold">Origin:</strong> {originCountry}</p>
      </div>
       {selectedFlightRoute ? (
          <div>
            <p>
              <strong className="font-semibold">Route:</strong> {selectedFlightRoute.departureAirport || 'N/A'} → {selectedFlightRoute.arrivalAirport || 'N/A'}
            </p>
          </div>
        ) : (
          <p className="text-gray-500">Route information is not available.</p>
        )}
      <hr />
      <div>
         <p><strong className="font-semibold">Speed:</strong> {velocity}</p>
         <p><strong className="font-semibold">Altitude:</strong> {altitude}</p>
      </div>
    </div>
  );
};

export default FlightDetailsPanel; 