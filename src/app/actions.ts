'use server';

import { FlightState, BoundingBox, Airport, AirportFilterType, FlightTrackPoint, FlightRouteInfo, AircraftMetadata } from '../types';
import fs from 'fs/promises';
import path from 'path';
import countryCodeMap from '../data/country-name-to-code.json';

// Log environment variables (without exposing secrets)
console.log('Environment check:');
console.log('- OPENSKY_CLIENT_ID available:', !!process.env.OPENSKY_CLIENT_ID);
console.log('- OPENSKY_CLIENT_SECRET available:', !!process.env.OPENSKY_CLIENT_SECRET);
console.log('- NODE_ENV:', process.env.NODE_ENV);

// Simple cache for flight data
const flightCache = new Map<string, { data: FlightState[]; timestamp: number }>();
const FLIGHT_CACHE_DURATION = 30 * 1000; // 30 seconds

// Helper function to map raw state vector to a structured FlightState object
function mapStateToFlightState(state: any[]): FlightState {
    const [
        icao24, callsign, origin_country, time_position, last_contact,
        longitude, latitude, baro_altitude, on_ground, velocity,
        true_track, vertical_rate, sensors, geo_altitude, squawk,
        spi, position_source, category
    ] = state;

    return {
        icao24,
        callsign: callsign?.trim() || null,
        origin_country,
        time_position,
        last_contact,
        longitude,
        latitude,
        baro_altitude,
        on_ground,
        velocity,
        true_track,
        vertical_rate,
        sensors,
        geo_altitude,
        squawk,
        spi,
        position_source,
        category,
        origin_country_code: (countryCodeMap as any)[origin_country] || '',
    };
}

export async function fetchAllFlights(bounds: BoundingBox): Promise<FlightState[]> {
    const url = `https://opensky-network.org/api/states/all?lamin=${bounds.lamin}&lomin=${bounds.lomin}&lamax=${bounds.lamax}&lomax=${bounds.lomax}`;
    
    // Check cache first
    const cacheKey = `${bounds.lamin}-${bounds.lomin}-${bounds.lamax}-${bounds.lomax}`;
    const cached = flightCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < FLIGHT_CACHE_DURATION) {
        console.log('fetchAllFlights: Returning cached data');
        return cached.data;
    }
    
    console.log('fetchAllFlights: Starting with bounds:', bounds);
    
    const clientId = process.env.OPENSKY_CLIENT_ID;
    const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
    
    console.log('fetchAllFlights: Client ID available:', !!clientId);
    console.log('fetchAllFlights: Client Secret available:', !!clientSecret);
    
    if (clientId && clientSecret) {
        try {
            console.log('fetchAllFlights: Attempting to get token...');
            const tokenResponse = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    'grant_type': 'client_credentials',
                    'client_id': clientId,
                    'client_secret': clientSecret,
                }),
            });

            console.log('fetchAllFlights: Token response status:', tokenResponse.status);
            
            if (tokenResponse.ok) {
                const tokenData = await tokenResponse.json();
                const token = tokenData.access_token;
                console.log('fetchAllFlights: Got token, length:', token ? token.length : 0);
                
                console.log('fetchAllFlights: Making authenticated request to:', url);
                const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
                console.log('fetchAllFlights: Authenticated response status:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('fetchAllFlights: Got data, states count:', data.states ? data.states.length : 0);
                    const flightStates = (data.states || []).map(mapStateToFlightState);
                    flightCache.set(cacheKey, { data: flightStates, timestamp: Date.now() });
                    return flightStates;
                } else {
                    console.log('fetchAllFlights: Authenticated request failed:', response.statusText);
                }
            } else {
                console.log('fetchAllFlights: Token request failed:', tokenResponse.statusText);
                const errorText = await tokenResponse.text();
                console.log('fetchAllFlights: Token error details:', errorText);
            }
        } catch (error) {
            console.warn('fetchAllFlights: Authenticated request failed, falling back to unauthenticated.', error);
        }
    } else {
        console.log('fetchAllFlights: No credentials available, using unauthenticated request');
    }

    try {
        console.log('fetchAllFlights: Making unauthenticated request to:', url);
        const response = await fetch(url);
        console.log('fetchAllFlights: Unauthenticated response status:', response.status);
        
        if (!response.ok) {
            console.log('fetchAllFlights: Unauthenticated request failed:', response.statusText);
            throw new Error(`Unauthenticated request failed: ${response.statusText}`);
        }
        const data = await response.json();
        console.log('fetchAllFlights: Got unauthenticated data, states count:', data.states ? data.states.length : 0);
        const flightStates = (data.states || []).map(mapStateToFlightState);
        flightCache.set(cacheKey, { data: flightStates, timestamp: Date.now() });
        return flightStates;
    } catch (error) {
        console.error("fetchAllFlights: All flight fetching attempts failed:", error);
        
        // If we have cached data, return it even if expired
        const cached = flightCache.get(cacheKey);
        if (cached) {
            console.log('fetchAllFlights: Returning expired cached data due to API error');
            return cached.data;
        }
        
        return [];
    }
}

async function getAirportsData(): Promise<any[]> {
    try {
        const filePath = path.join(process.cwd(), 'src', 'data', 'airports.json');
        const fileContents = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(fileContents);
        // The JSON could be an object with ICAO codes as keys, convert it to an array
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
            return Object.values(data);
        }
        // If it's already an array, return it as is
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Failed to read or parse airports.json:", error);
        // Return empty array on error instead of crashing
        return [];
    }
}

export async function fetchAirports(bbox: BoundingBox, filter: AirportFilterType = 'all'): Promise<Airport[]> {
    const allAirports: any[] = await getAirportsData();
    
    if (!Array.isArray(allAirports)) {
        console.error("fetchAirports: allAirports is not an array, returning empty.");
        return [];
    }
    
    const filteredByBounds = allAirports.filter(apt => 
        apt && // ensure apt is not null/undefined
        typeof apt.lat === 'number' &&
        typeof apt.lon === 'number' &&
        apt.lat >= bbox.lamin &&
        apt.lat <= bbox.lamax &&
        apt.lon >= bbox.lomin &&
        apt.lon <= bbox.lomax
    );

    if (filter === 'main') {
        const main = filteredByBounds.filter(apt => apt.iata);
        return main;
    }

    return filteredByBounds;
};


export async function fetchAircraftMetadata(icao24: string, callsign?: string | null, registration?: string | null): Promise<AircraftMetadata | null> {
    try {
        // console.log('fetchAircraftMetadata: Fetching for ICAO24:', icao24);
        
        // Use our new integrated API endpoint with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        const params = new URLSearchParams();
        params.append('icao24', icao24.toLowerCase());
        if (callsign) {
            params.append('callsign', callsign);
        }
        if (registration) {
            params.append('registration', registration);
        }
        
        // Use absolute URL for server-side calls
        const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        
        const response = await fetch(`${baseUrl}/api/aircraft-info?${params.toString()}`, {
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            // console.log('fetchAircraftMetadata: API response not ok:', response.statusText);
            return null;
        }
        
        const result = await response.json();
        // console.log('fetchAircraftMetadata: API result:', result);
        
        if (result.success && result.data) {
            const aircraftData = result.data;
            return {
                model: aircraftData.model || 'Unknown',
                registration: aircraftData.registration || 'Unknown',
                imageUrl: aircraftData.photoUrl || null,
                manufacturer: aircraftData.manufacturer || null,
                owner: aircraftData.owner || null,
                operator: aircraftData.operator || null,
                yearBuilt: aircraftData.yearBuilt || null,
                engineType: aircraftData.engineType || null,
                photoUrl: aircraftData.photoUrl || null,
            };
        }
        
        return null;
        
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('fetchAircraftMetadata: Timeout');
        } else {
            console.error('fetchAircraftMetadata: Error:', error);
        }
        return null;
    }
}

export async function fetchFlightTrack(icao24: string): Promise<FlightTrackPoint[] | null> {
    const clientId = process.env.OPENSKY_CLIENT_ID;
    const clientSecret = process.env.OPENSKY_CLIENT_SECRET;

    if (!clientId || !clientSecret) return null;

    let token = null;
    try {
        const tokenResponse = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'grant_type': 'client_credentials',
                'client_id': clientId,
                'client_secret': clientSecret,
            }),
        });
        
        if (!tokenResponse.ok) return null;
        
        const tokenData = await tokenResponse.json();
        token = tokenData.access_token;

    } catch (error) {
        return null;
    }

    if (!token) return null;

    try {
        const url = `https://opensky-network.org/api/tracks/all?icao24=${icao24}&time=0`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) return null;
        
        const data = await response.json();

        if (!data || !data.path || data.path.length === 0) return null;

        return data.path.map((p: any) => ({
            time: p[0],
            latitude: p[1],
            longitude: p[2],
            baro_altitude: p[3],
            true_track: p[4],
            on_ground: p[5],
            velocity: p[6],
            vertical_rate: p[7],
            callsign: data.callsign,
        }));
    } catch (error) {
        return null;
    }
}

export async function fetchFlightPlan(icao24: string, callsign: string | null): Promise<FlightRouteInfo | null> {
    if (!callsign) return null;

    try {
        const response = await fetch(`https://aerodatabox.p.rapidapi.com/flights/callsign/${callsign.trim()}`, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': process.env.AERODATABOX_API_KEY!,
                'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com',
            },
        });
        if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
                const flight = data[0];
                if (flight.departure?.airport?.name && flight.arrival?.airport?.name) {
                    return {
                        departureAirport: flight.departure.airport.name,
                        arrivalAirport: flight.arrival.airport.name,
                    };
                }
            }
        }
    } catch (error) {
        console.error('Error fetching from AeroDataBox:', error);
    }
    return null;
}

export async function fetchLatestFlightState(icao24: string): Promise<FlightState | null> {
    try {
        // Clean ICAO24 - remove spaces and ensure proper format
        const cleanIcao24 = icao24.trim().toLowerCase();
        console.log('fetchLatestFlightState: Original ICAO24:', icao24);
        console.log('fetchLatestFlightState: Cleaned ICAO24:', cleanIcao24);
        
        const clientId = process.env.OPENSKY_CLIENT_ID;
        const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
        
        let headers = {};
        
        // Try authenticated request first if credentials are available
        if (clientId && clientSecret) {
            try {
                const tokenResponse = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        'grant_type': 'client_credentials',
                        'client_id': clientId,
                        'client_secret': clientSecret,
                    }),
                });

                if (tokenResponse.ok) {
                    const tokenData = await tokenResponse.json();
                    const token = tokenData.access_token;
                    headers = { 'Authorization': `Bearer ${token}` };
                    console.log('fetchLatestFlightState: Using authenticated request');
                    
                    const response = await fetch(`https://opensky-network.org/api/states/all?icao24=${cleanIcao24}`, { headers });
                    console.log('fetchLatestFlightState: Authenticated response status:', response.status);
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log('fetchLatestFlightState: Authenticated data received:', data);
                        
                        if (data.states && data.states.length > 0) {
                            const state = data.states[0];
                            const flightState = mapStateToFlightState(state);
                            console.log('fetchLatestFlightState: Mapped flight state:', flightState);
                            return flightState;
                        }
                    } else if (response.status === 429) {
                        console.log('fetchLatestFlightState: Rate limit hit, falling back to unauthenticated request');
                    } else {
                        console.log('fetchLatestFlightState: Authenticated request failed:', response.statusText);
                    }
                }
            } catch (error) {
                console.warn('fetchLatestFlightState: Authentication failed, using unauthenticated request:', error);
            }
        }
        
        // Fallback to unauthenticated request
        console.log('fetchLatestFlightState: Using unauthenticated request');
        const response = await fetch(`https://opensky-network.org/api/states/all?icao24=${cleanIcao24}`);
        console.log('fetchLatestFlightState: Unauthenticated response status:', response.status);
        
        if (!response.ok) {
            console.log('fetchLatestFlightState: Unauthenticated response not ok:', response.statusText);
            return null;
        }
        
        const data = await response.json();
        console.log('fetchLatestFlightState: Unauthenticated data received:', data);
        
        if (!data.states || data.states.length === 0) {
            console.log('fetchLatestFlightState: No states found for ICAO24:', cleanIcao24);
            return null;
        }
        
        const state = data.states[0];
        const flightState = mapStateToFlightState(state);
        console.log('fetchLatestFlightState: Mapped flight state:', flightState);
        return flightState;
    } catch (error) {
        console.error('fetchLatestFlightState: Error:', error);
        return null;
    }
}