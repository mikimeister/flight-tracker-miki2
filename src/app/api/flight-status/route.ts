import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-static";

// The state vector from OpenSky API has a specific structure.
// We are interested in these indices:
// 0: icao24
// 1: callsign (might be flight number or registration)
// 2: origin_country
// 8: on_ground
// See OpenSky API docs for more details.
type OpenSkyStateVector = [
  string, // icao24
  string | null, // callsign
  string, // origin_country
  number | null, // time_position
  number, // last_contact
  number | null, // longitude
  number | null, // latitude
  number | null, // baro_altitude
  boolean, // on_ground
  number | null, // velocity
  number | null, // true_track
  number | null, // vertical_rate
  number[] | null, // sensors
  number | null, // geo_altitude
  string | null, // squawk
  boolean, // spi
  number, // position_source
  number, // category
];

// --- Helper function moved directly into the API route file ---
// This avoids any import/path issues.
async function getOpenSkyAccessToken(): Promise<string | null> {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('OpenSky credentials are not set in environment variables.');
    return null;
  }

  try {
    const response = await fetch('https://opensky-network.org/api/auth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        'grant_type': 'client_credentials',
        'client_id': clientId,
        'client_secret': clientSecret,
      }),
    });

    if (!response.ok) {
      console.error(`Failed to get OpenSky token: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error fetching OpenSky token:', error);
    return null;
  }
}
// --- End of helper function ---

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, icao24, fetchAll } = body;

    const token = await getOpenSkyAccessToken();
    if (!token) {
      return NextResponse.json({ error: 'Could not authenticate with OpenSky' }, { status: 500 });
    }
    const headers = new Headers({ 'Authorization': `Bearer ${token}` });

    if (fetchAll) {
      // --- Fetch All Airborne Aircraft ---
      const response = await fetch('https://opensky-network.org/api/states/all', { headers });
      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch all states from OpenSky' }, { status: response.status });
      }
      const data = await response.json();
      const allStates: OpenSkyStateVector[] = data.states || [];

      const airborneStates = allStates
        .filter(state => !state[8] && state[5] && state[6]) // Filter for aircraft that are not on ground and have position
        .map(state => ({
          icao24: state[0],
          callsign: state[1],
          longitude: state[5],
          latitude: state[6],
          true_track: state[10],
          on_ground: state[8]
        }));
      
      return NextResponse.json(airborneStates);
    }
    
    if (icao24) {
      // --- Single Aircraft Detail Fetch ---
      const response = await fetch(`https://opensky-network.org/api/states/all?icao24=${icao24}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch data from OpenSky' }, { status: response.status });
      }
      
      const data = await response.json();
      
      if (!data.states || data.states.length === 0) {
        return NextResponse.json({ error: 'No state vector found for this aircraft.' }, { status: 404 });
      }

      // Return the detailed state vector for the single aircraft
      const state = data.states[0];
      const flightDetails = {
        icao24: state[0]?.trim(),
        callsign: state[1]?.trim(),
        origin_country: state[2],
        time_position: state[3],
        last_contact: state[4],
        longitude: state[5],
        latitude: state[6],
        baro_altitude: state[7],
        on_ground: state[8],
        velocity: state[9],
        true_track: state[10], // Flight direction in degrees
        vertical_rate: state[11],
        sensors: state[12],
        geo_altitude: state[13],
        spi: state[14],
        position_source: state[15],
      };

      return NextResponse.json(flightDetails);

    } else if (items) {
      // --- Batch Status Fetch for List View ---
      const response = await fetch('https://opensky-network.org/api/states/all', { headers });

      if (!response.ok) {
        return NextResponse.json({ error: `Failed to fetch from OpenSky: ${response.statusText}` }, { status: response.status });
      }
      const data = await response.json();
      const allStates = data.states || [];
      const statuses: { [key: string]: any } = {};
      const cleanedTrackedItems = items.map((r: string) => r.replace(/[^A-Z0-9]/gi, '').toUpperCase());

      for (const state of allStates) {
        const callsign = state[1]?.trim().toUpperCase() || '';
        const registration = state[0]?.trim().toUpperCase() || '';
        if (cleanedTrackedItems.includes(callsign) || cleanedTrackedItems.includes(registration)) {
          const status = {
            icao24: state[0]?.trim(), callsign: state[1]?.trim(),
            on_ground: state[8], origin_country: state[2],
          };
          if(cleanedTrackedItems.includes(callsign)) statuses[callsign] = status;
          if(cleanedTrackedItems.includes(registration)) statuses[registration] = status;
        }
      }
      return NextResponse.json({
        statuses: statuses,
        diagnostics: { totalStatesReceived: allStates.length, timestamp: new Date().toISOString() }
      });

    } else {
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Error in flight-status API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}