'use client';

import Link from 'next/link';
import { FlightState, FlightRouteInfo } from '../types';

interface PopupContentProps {
    flight: FlightState;
    airlineInfo: { name: string; iata: string } | null | undefined;
    routeInfo: FlightRouteInfo | null | undefined;
    isLoading: boolean | undefined;
}

const PopupContent = ({ flight, airlineInfo, routeInfo, isLoading }: PopupContentProps) => {
    if (isLoading) {
        return <p className="text-center">Loading details...</p>;
    }

    const FlagAndCountry = () => (
        <div className="flex items-center justify-center space-x-2 mt-1">
            <img
                src={`https://flagcdn.com/w20/${flight.origin_country_code}.png`}
                alt={`${flight.origin_country} flag`}
                width="20"
                className="shadow-sm"
            />
            <p className="text-gray-600 text-sm">{flight.origin_country}</p>
        </div>
    );
    
    return (
        <div className="text-sm text-center p-1" style={{ minWidth: '180px' }}>
            <h3 className="font-bold text-base">{flight.callsign || 'N/A'}</h3>
            {airlineInfo?.iata && (
                <img 
                    src={`https://www.gstatic.com/flights/airline_logos/70px/${airlineInfo.iata}.png`} 
                    alt={`${airlineInfo.name} logo`}
                    className="mx-auto my-2 h-8"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
            )}
            <p className="text-gray-700 font-medium">{airlineInfo?.name || 'Private or Unknown'}</p>

            {routeInfo?.departureAirport ? (
                <p className="mt-1">
                    {routeInfo.departureAirport} → {routeInfo.arrivalAirport}
                </p>
            ) : (
                <FlagAndCountry />
            )}

            <Link href={`/details/${flight.icao24}`} className="block text-center mt-3 text-blue-600 hover:underline font-semibold" onClick={() => console.log('PopupContent: Navigating to details for ICAO24:', flight.icao24)}>
                Details →
            </Link>
        </div>
    );
};

export default PopupContent; 