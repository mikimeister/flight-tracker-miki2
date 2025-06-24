import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for OpenSky CSV database
const openskyCSVCache = new Map<string, any>();
const OPENSKY_CSV_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface AircraftInfo {
  registration: string | null;
  model: string | null;
  manufacturer: string | null;
  owner: string | null;
  operator: string | null;
  yearBuilt: string | null;
  engineType: string | null;
  category: string | null;
  photoUrl: string | null;
}

// Function to get aircraft info from OpenSky API
async function getOpenSkyInfo(icao24: string): Promise<Partial<AircraftInfo>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`https://opensky-network.org/api/metadata/aircraft/icao/${icao24.toLowerCase()}`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`OpenSky API: HTTP ${response.status} for ${icao24}`);
      return {};
    }
    
    const data = await response.json();
    
    // Check if OpenSky returned an error or empty response
    if (!data || Object.keys(data).length === 0) {
      console.log(`OpenSky API: No data found for ${icao24}`);
      return {};
    }
    
    console.log(`OpenSky API: Found data for ${icao24}:`, data);
    
    return {
      registration: data.registration || null,
      model: data.model || null,
      manufacturer: data.manufacturerName || null,
      owner: data.owner || null,
      operator: data.operator || null,
      yearBuilt: data.yearBuilt || null,
      engineType: data.engineType || null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('OpenSky API timeout');
    } else {
      console.error('OpenSky API error:', error);
    }
    return {};
  }
}

// Function to get aircraft info from Planespotters API
async function getPlanespottersInfo(registration: string): Promise<Partial<AircraftInfo>> {
  try {
    console.log(`Planespotters API: Starting fetch for registration: ${registration}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    // Try to get photos first
    const photosUrl = `https://api.planespotters.net/pub/photos/reg/${registration}`;
    console.log(`Planespotters API: Fetching photos from: ${photosUrl}`);
    
    const photosResponse = await fetch(photosUrl, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    let photoUrl = null;
    
    console.log(`Planespotters API: Photos response status: ${photosResponse.status}`);
    
    if (photosResponse.ok) {
      const photosData = await photosResponse.json();
      console.log(`Planespotters API: Photos data:`, JSON.stringify(photosData, null, 2));
      
      if (photosData.photos && photosData.photos.length > 0) {
        // Use the first photo's large thumbnail
        const firstPhoto = photosData.photos[0];
        console.log(`Planespotters API: First photo:`, JSON.stringify(firstPhoto, null, 2));
        
        photoUrl = firstPhoto.thumbnail_large?.src || firstPhoto.thumbnail?.src || null;
        console.log(`Planespotters API: Selected photo URL: ${photoUrl}`);
      } else {
        console.log(`Planespotters API: No photos found for ${registration}`);
      }
    } else {
      console.log(`Planespotters Photos API: HTTP ${photosResponse.status} for ${registration}`);
      const errorText = await photosResponse.text();
      console.log(`Planespotters Photos API: Error response: ${errorText}`);
    }
    
    // Try to get aircraft info (but this endpoint seems to be broken)
    let aircraftInfo = {};
    try {
      const aircraftResponse = await fetch(`https://api.planespotters.net/pub/aircraft/reg/${registration}`, {
        signal: controller.signal,
      });
      
      if (aircraftResponse.ok) {
        const data = await aircraftResponse.json();
        
        // Check if Planespotters returned an error
        if (!data.error && data.aircraft && data.aircraft.length > 0) {
          const aircraft = data.aircraft[0];
          console.log(`Planespotters API: Found aircraft for ${registration}:`, aircraft);
          
          aircraftInfo = {
            model: aircraft.model || null,
            manufacturer: aircraft.manufacturer || null,
            owner: aircraft.owner || null,
            operator: aircraft.operator || null,
            yearBuilt: aircraft.yearBuilt || null,
          };
        }
      }
    } catch (error) {
      console.log(`Planespotters Aircraft API: Error for ${registration}:`, error);
    }
    
    const result = {
      ...aircraftInfo,
      photoUrl,
    };
    
    console.log(`Planespotters API: Final result for ${registration}:`, result);
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Planespotters API timeout');
    } else {
      console.error('Planespotters API error:', error);
    }
    return {};
  }
}

// Function to get aircraft info from FlightAware API (if available)
async function getFlightAwareInfo(registration: string): Promise<Partial<AircraftInfo>> {
  try {
    // FlightAware API requires authentication, so this is a placeholder
    // You would need to add your FlightAware API key to environment variables
    const apiKey = process.env.FLIGHTAWARE_API_KEY;
    if (!apiKey) return {};
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`https://aeroapi.flightaware.com/aeroapi/aircraft/${registration}`, {
      headers: {
        'x-apikey': apiKey,
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return {};
    
    const data = await response.json();
    return {
      model: data.aircraft_type || null,
      manufacturer: data.manufacturer || null,
      owner: data.owner || null,
      operator: data.operator || null,
      yearBuilt: data.year_built || null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('FlightAware API timeout');
    } else {
      console.error('FlightAware API error:', error);
    }
    return {};
  }
}

// Function to get aircraft info from Aviation Safety Database
async function getAviationSafetyInfo(registration: string): Promise<Partial<AircraftInfo>> {
  try {
    // This would require scraping the aviation safety website
    // For now, return empty object as it requires more complex implementation
    return {};
  } catch (error) {
    console.error('Aviation Safety API error:', error);
    return {};
  }
}

// Function to get aircraft info from Aviation Stack API
async function getAviationStackInfo(registration: string): Promise<Partial<AircraftInfo>> {
  try {
    const apiKey = process.env.AVIATIONSTACK_API_KEY;
    if (!apiKey) return {};
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`http://api.aviationstack.com/v1/airplanes?access_key=${apiKey}&search=${registration}`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return {};
    
    const data = await response.json();
    if (!data.data || data.data.length === 0) return {};
    
    const aircraft = data.data[0];
    return {
      model: aircraft.airplane_name || null,
      manufacturer: aircraft.manufacturer || null,
      yearBuilt: aircraft.year_built || null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Aviation Stack API timeout');
    } else {
      console.error('Aviation Stack API error:', error);
    }
    return {};
  }
}

// Function to get aircraft info from OpenSky CSV database
async function getOpenSkyCSVInfo(registration: string): Promise<Partial<AircraftInfo>> {
  try {
    // Check cache first
    const cached = openskyCSVCache.get(registration);
    if (cached && Date.now() - cached.timestamp < OPENSKY_CSV_CACHE_DURATION) {
      console.log(`OpenSky CSV: Returning cached data for ${registration}`);
      return cached.data;
    }
    
    console.log(`OpenSky CSV: Starting search for registration: ${registration}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for large file
    
    const response = await fetch('https://s3.opensky-network.org/data-samples/metadata/aircraftDatabase.csv', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SKYTRACK: Aviation-based intelligence gathering tool - https://github.com/ANG13T/skytrack'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`OpenSky CSV: HTTP ${response.status}`);
      return {};
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n');
    
    console.log(`OpenSky CSV: Processing ${lines.length} lines`);
    console.log(`OpenSky CSV: Looking for registration: ${registration}`);
    
    // Debug: sprawdź pierwsze kilka linii
    console.log(`OpenSky CSV: First few lines:`, lines.slice(0, 5));
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // Parse CSV line (simple parsing)
      const values = line.split('","').map(v => v.replace(/"/g, ''));
      
      // Debug: sprawdź format pierwszej linii z danymi
      if (i === 1) {
        console.log(`OpenSky CSV: First data line values:`, values);
        console.log(`OpenSky CSV: First data line length:`, values.length);
      }
      
      if (values.length >= 20) {
        const icao24 = values[0];
        const reg = values[1];
        const manufacturerIcao = values[2];
        const manufacturerName = values[3];
        const model = values[4];
        const typeCode = values[5];
        const operator = values[9];
        const owner = values[13];
        const built = values[18];
        
        // Use manufacturer name if available, otherwise use ICAO code
        const manufacturer = manufacturerName || manufacturerIcao;
        
        // Log every 1000th line to see progress
        if (i % 1000 === 0) {
          console.log(`OpenSky CSV: Processing line ${i}, current registration: ${reg}`);
        }
        
        // Debug: sprawdź czy rejestracja zawiera nasz wzorzec
        if (reg && reg.includes('SP') && reg.includes('LVS')) {
          console.log(`OpenSky CSV: Found potential match at line ${i}:`, {
            icao24,
            registration: reg,
            fullLine: line
          });
        }
        
        if (reg === registration) {
          console.log(`OpenSky CSV: Found aircraft for ${registration}:`, {
            icao24,
            registration: reg,
            manufacturerIcao,
            manufacturerName,
            manufacturer,
            model,
            typeCode,
            operator,
            owner,
            built,
            fullLine: line
          });
          
          const aircraftInfo: Partial<AircraftInfo> = {
            registration: reg,
            model: model || typeCode || null,
            manufacturer: manufacturer || null,
            owner: owner || null,
            operator: operator || null,
            yearBuilt: built || null,
            engineType: null,
            category: null,
            photoUrl: null,
          };
          
          // Save to cache
          openskyCSVCache.set(registration, {
            data: aircraftInfo,
            timestamp: Date.now(),
          });
          
          return aircraftInfo;
        }
      }
    }
    
    console.log(`OpenSky CSV: No aircraft found for ${registration}`);
    console.log(`OpenSky CSV: Searched through ${lines.length} lines`);
    return {};
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('OpenSky CSV timeout');
    } else {
      console.error('OpenSky CSV error:', error);
    }
    return {};
  }
}

// Function to get aircraft info from Supabase database
async function getSupabaseAircraftInfo(registration: string): Promise<Partial<AircraftInfo>> {
  try {
    console.log(`Supabase: Looking for registration: ${registration}`);
    
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('Supabase: Missing environment variables');
      return {};
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase
      .from('aircraft_metadata')
      .select('*')
      .eq('registration', registration)
      .single();
    
    if (error) {
      console.log(`Supabase: Error querying database:`, error);
      return {};
    }
    
    if (!data) {
      console.log(`Supabase: No aircraft found for registration: ${registration}`);
      return {};
    }
    
    console.log(`Supabase: Found aircraft for ${registration}:`, data);
    
    return {
      registration: data.registration,
      model: data.model || data.type_code || null,
      manufacturer: data.manufacturer_name || data.manufacturer_icao || null,
      owner: data.owner || null,
      operator: data.operator || null,
      yearBuilt: data.built || null,
      engineType: data.engines || null,
    };
    
  } catch (error) {
    console.error('Supabase: Error:', error);
    return {};
  }
}

// Function to determine aircraft category based on model
function getAircraftCategory(model: string | null): string {
  if (!model) return 'unknown';
  
  const modelUpper = model.toUpperCase().trim();
  
  // Large commercial jets (A350, A380, B747, B777, B787, B767)
  if (modelUpper.includes('A350') || modelUpper.includes('A380') || 
      modelUpper.includes('B747') || modelUpper.includes('B777') || 
      modelUpper.includes('B787') || modelUpper.includes('B767')) {
    return 'A5'; // Heavy
  }
  
  // Medium commercial jets (ALL Airbus A3xx, ALL Boeing 7xx, B757, A300, A310, MD80, MD90)
  if (modelUpper.includes('A3') || modelUpper.includes('B7') || modelUpper.includes('B757') ||
      modelUpper.includes('A300') || modelUpper.includes('A310') || 
      modelUpper.includes('MD80') || modelUpper.includes('MD90')) {
    return 'A3'; // Medium - wszystkie Boeingi i Airbusy
  }
  
  // Regional jets (Embraer, Bombardier, ATR)
  if (modelUpper.includes('E170') || modelUpper.includes('E175') || modelUpper.includes('E190') || 
      modelUpper.includes('E195') || modelUpper.includes('E275') || modelUpper.includes('E290') || 
      modelUpper.includes('E295') || modelUpper.includes('CRJ') || modelUpper.includes('ATR') || 
      modelUpper.includes('DASH8') || modelUpper.includes('Q400')) {
    return 'A2'; // Regional - Embraer, Bombardier, ATR
  }
  
  // Small commercial aircraft (CESSNA, PIPER, BEECHCRAFT, CIRRUS, DIAMOND, ROBIN)
  if (modelUpper.includes('CESSNA') || modelUpper.includes('PIPER') || modelUpper.includes('BEECHCRAFT') ||
      modelUpper.includes('CIRRUS') || modelUpper.includes('DIAMOND') || modelUpper.includes('ROBIN')) {
    return 'A1'; // Small
  }
  
  // Helicopters
  if (modelUpper.includes('HELICOPTER') || modelUpper.includes('ROTORCRAFT') || 
      modelUpper.includes('H125') || modelUpper.includes('H135') || modelUpper.includes('H145') || 
      modelUpper.includes('H175') || modelUpper.includes('AW139') || modelUpper.includes('AW169') || 
      modelUpper.includes('AW189')) {
    return 'B1'; // Helicopter
  }
  
  return 'unknown';
}

// Function to extract registration from callsign
function extractRegistrationFromCallsign(callsign: string | null): string | null {
  if (!callsign) return null;
  
  const cleanCallsign = callsign.trim().toUpperCase();
  
  // Lista popularnych prefixów rejestracji
  const registrationPrefixes = [
    // Czech Republic
    'OK', 'OL', 'OM', 'ON', 'OO', 'OP', 'OQ', 'OR', 'OS', 'OT', 'OU', 'OV', 'OW', 'OX', 'OY', 'OZ',
    // Poland
    'SP', 'SN', 'SO', 'SO', 'SQ', 'SR', 'SS', 'ST', 'SU', 'SV', 'SW', 'SX', 'SY', 'SZ',
    // Germany
    'D', 'DA', 'DB', 'DC', 'DD', 'DE', 'DF', 'DG', 'DH', 'DI', 'DJ', 'DK', 'DL', 'DM', 'DN', 'DO', 'DP', 'DQ', 'DR', 'DS', 'DT', 'DU', 'DV', 'DW', 'DX', 'DY', 'DZ',
    // Austria
    'OE', 'OF', 'OG', 'OH', 'OI', 'OJ', 'OK', 'OL', 'OM', 'ON', 'OO', 'OP', 'OQ', 'OR', 'OS', 'OT', 'OU', 'OV', 'OW', 'OX', 'OY', 'OZ',
    // United Kingdom
    'G', 'GA', 'GB', 'GC', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GJ', 'GK', 'GL', 'GM', 'GN', 'GO', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GV', 'GW', 'GX', 'GY', 'GZ',
    // Switzerland
    'HB', 'HC', 'HD', 'HE', 'HF', 'HG', 'HH', 'HI', 'HJ', 'HK', 'HL', 'HM', 'HN', 'HO', 'HP', 'HQ', 'HR', 'HS', 'HT', 'HU', 'HV', 'HW', 'HX', 'HY', 'HZ',
    // Luxembourg
    'LX', 'LY', 'LZ',
    // Hungary
    'HA', 'HB', 'HC', 'HD', 'HE', 'HF', 'HG', 'HH', 'HI', 'HJ', 'HK', 'HL', 'HM', 'HN', 'HO', 'HP', 'HQ', 'HR', 'HS', 'HT', 'HU', 'HV', 'HW', 'HX', 'HY', 'HZ',
    // France
    'F', 'FA', 'FB', 'FC', 'FD', 'FE', 'FF', 'FG', 'FH', 'FI', 'FJ', 'FK', 'FL', 'FM', 'FN', 'FO', 'FP', 'FQ', 'FR', 'FS', 'FT', 'FU', 'FV', 'FW', 'FX', 'FY', 'FZ',
    // Italy
    'I', 'IA', 'IB', 'IC', 'ID', 'IE', 'IF', 'IG', 'IH', 'II', 'IJ', 'IK', 'IL', 'IM', 'IN', 'IO', 'IP', 'IQ', 'IR', 'IS', 'IT', 'IU', 'IV', 'IW', 'IX', 'IY', 'IZ',
    // Spain
    'EC', 'ED', 'EE', 'EF', 'EG', 'EH', 'EI', 'EJ', 'EK', 'EL', 'EM', 'EN', 'EO', 'EP', 'EQ', 'ER', 'ES', 'ET', 'EU', 'EV', 'EW', 'EX', 'EY', 'EZ',
    // Netherlands
    'PH', 'PI', 'PJ', 'PK', 'PL', 'PM', 'PN', 'PO', 'PP', 'PQ', 'PR', 'PS', 'PT', 'PU', 'PV', 'PW', 'PX', 'PY', 'PZ',
    // Belgium
    'OO', 'OP', 'OQ', 'OR', 'OS', 'OT', 'OU', 'OV', 'OW', 'OX', 'OY', 'OZ',
    // Denmark
    'OY', 'OZ',
    // Norway
    'LN', 'LO', 'LP', 'LQ', 'LR', 'LS', 'LT', 'LU', 'LV', 'LW', 'LX', 'LY', 'LZ',
    // Sweden
    'SE', 'SF', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SP', 'SQ', 'SR', 'SS', 'ST', 'SU', 'SV', 'SW', 'SX', 'SY', 'SZ',
    // Finland
    'OH', 'OI', 'OJ', 'OK', 'OL', 'OM', 'ON', 'OO', 'OP', 'OQ', 'OR', 'OS', 'OT', 'OU', 'OV', 'OW', 'OX', 'OY', 'OZ',
    // Estonia
    'ES', 'ET', 'EU', 'EV', 'EW', 'EX', 'EY', 'EZ',
    // Latvia
    'YL', 'YM', 'YN', 'YO', 'YP', 'YQ', 'YR', 'YS', 'YT', 'YU', 'YV', 'YW', 'YX', 'YY', 'YZ',
    // Lithuania
    'LY', 'LZ',
    // Slovakia
    'OM', 'ON', 'OO', 'OP', 'OQ', 'OR', 'OS', 'OT', 'OU', 'OV', 'OW', 'OX', 'OY', 'OZ',
    // Slovenia
    'S5', 'S6', 'S7', 'S8', 'S9',
    // Croatia
    '9A', '9B', '9C', '9D', '9E', '9F', '9G', '9H', '9I', '9J', '9K', '9L', '9M', '9N', '9O', '9P', '9Q', '9R', '9S', '9T', '9U', '9V', '9W', '9X', '9Y', '9Z',
    // Serbia
    'YU', 'YV', 'YW', 'YX', 'YY', 'YZ',
    // Bulgaria
    'LZ', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9',
    // Romania
    'YR', 'YS', 'YT', 'YU', 'YV', 'YW', 'YX', 'YY', 'YZ',
    // Greece
    'SX', 'SY', 'SZ',
    // Cyprus
    '5B', '5C', '5D', '5E', '5F', '5G', '5H', '5I', '5J', '5K', '5L', '5M', '5N', '5O', '5P', '5Q', '5R', '5S', '5T', '5U', '5V', '5W', '5X', '5Y', '5Z',
    // Malta
    '9H', '9I', '9J', '9K', '9L', '9M', '9N', '9O', '9P', '9Q', '9R', '9S', '9T', '9U', '9V', '9W', '9X', '9Y', '9Z',
    // Ireland
    'EI', 'EJ', 'EK', 'EL', 'EM', 'EN', 'EO', 'EP', 'EQ', 'ER', 'ES', 'ET', 'EU', 'EV', 'EW', 'EX', 'EY', 'EZ',
    // Portugal
    'CS', 'CT', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ',
    // Iceland
    'TF', 'TG', 'TH', 'TI', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TP', 'TQ', 'TR', 'TS', 'TT', 'TU', 'TV', 'TW', 'TX', 'TY', 'TZ',
  ];
  
  // Sprawdź czy callsign zaczyna się od któregoś z prefixów
  for (const prefix of registrationPrefixes) {
    if (cleanCallsign.startsWith(prefix)) {
      // Jeśli callsign ma długość prefix + 1-3 znaki, to prawdopodobnie rejestracja
      const suffix = cleanCallsign.substring(prefix.length);
      if (suffix.length >= 1 && suffix.length <= 3) {
        // Sprawdź czy suffix zawiera tylko litery i cyfry
        if (/^[A-Z0-9]+$/.test(suffix)) {
          // Formatuj jako rejestrację z myślnikiem
          return `${prefix}-${suffix}`;
        }
      }
    }
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const icao24 = searchParams.get('icao24');
  const registration = searchParams.get('registration');
  const callsign = searchParams.get('callsign');
  
  if (!icao24 && !registration) {
    return NextResponse.json({ error: 'ICAO24 or registration is required' }, { status: 400 });
  }
  
  console.log(`API: Fetching aircraft info for ICAO24: ${icao24}, Registration: ${registration}, Callsign: ${callsign}`);
  
  // Check cache first
  const cacheKey = icao24 || registration || '';
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`API: Returning cached data for ${cacheKey}`);
    return NextResponse.json({
      success: true,
      data: cached.data,
      cached: true,
      sources: {
        opensky: !!icao24,
        planespotters: !!registration,
        supabase: !!registration,
        flightaware: !!process.env.FLIGHTAWARE_API_KEY,
        aviationstack: !!process.env.AVIATIONSTACK_API_KEY,
      },
    });
  }
  
  try {
    let aircraftInfo: AircraftInfo = {
      registration: null,
      model: null,
      manufacturer: null,
      owner: null,
      operator: null,
      yearBuilt: null,
      engineType: null,
      category: null,
      photoUrl: null,
    };
    
    // If we have ICAO24, get registration from OpenSky first
    if (icao24) {
      console.log(`API: Trying OpenSky for ICAO24: ${icao24}`);
      const openskyInfo = await getOpenSkyInfo(icao24);
      console.log(`API: OpenSky result:`, openskyInfo);
      aircraftInfo = { ...aircraftInfo, ...openskyInfo };
      
      // Fallback: jeśli nie ma modelu, a jest rejestracja, szukaj po rejestracji w Supabase
      if ((!openskyInfo.model || openskyInfo.model === '' || openskyInfo.model === null) && openskyInfo.registration) {
        console.log(`API: Fallback - Trying Supabase for registration: ${openskyInfo.registration}`);
        const supabaseInfo = await getSupabaseAircraftInfo(openskyInfo.registration);
        console.log(`API: Supabase fallback result:`, supabaseInfo);
        aircraftInfo = { ...aircraftInfo, ...supabaseInfo };
      }
      
      // If we got basic info, return early for faster response
      if (aircraftInfo.registration || aircraftInfo.model) {
        aircraftInfo.category = getAircraftCategory(aircraftInfo.model);
        
        // Always try to get photo from Planespotters, even if we have OpenSky data
        if (aircraftInfo.registration) {
          console.log(`API: Trying Planespotters for photo with registration: ${aircraftInfo.registration}`);
          const planespottersInfo = await getPlanespottersInfo(aircraftInfo.registration);
          if (planespottersInfo.photoUrl) {
            aircraftInfo.photoUrl = planespottersInfo.photoUrl;
            console.log(`API: Got photo from Planespotters: ${planespottersInfo.photoUrl}`);
          }
        }
        
        // Save to cache
        apiCache.set(cacheKey, {
          data: aircraftInfo,
          timestamp: Date.now(),
        });
        
        console.log(`API: Returning early with OpenSky data for ${icao24}`);
        return NextResponse.json({
          success: true,
          data: aircraftInfo,
          cached: false,
          sources: {
            opensky: true,
            planespotters: !!aircraftInfo.photoUrl,
            supabase: !!aircraftInfo.registration,
            flightaware: false,
            aviationstack: false,
          },
        });
      }
    }
    
    // If we have registration (either from ICAO24 lookup or direct parameter), get additional info
    let targetRegistration = aircraftInfo.registration || registration;
    
    // Jeśli nie ma rejestracji, ale jest callsign, spróbuj wyciągnąć rejestrację z callsign
    if (!targetRegistration && callsign) {
      const extractedRegistration = extractRegistrationFromCallsign(callsign);
      if (extractedRegistration) {
        console.log(`API: Extracted registration ${extractedRegistration} from callsign ${callsign}`);
        targetRegistration = extractedRegistration;
        aircraftInfo.registration = extractedRegistration;
      } else {
        // Fallback: spróbuj pobrać zdjęcie z Planespotters po samym callsign jako rejestracji
        console.log(`API: Fallback - Trying Planespotters for callsign as registration: ${callsign}`);
        const planespottersInfo = await getPlanespottersInfo(callsign);
        if (planespottersInfo.photoUrl) {
          aircraftInfo.photoUrl = planespottersInfo.photoUrl;
        }
      }
    }
    
    if (targetRegistration) {
      console.log(`API: Trying Planespotters for registration: ${targetRegistration}`);
      // Get info from Planespotters first (zawsze priorytet)
      const planespottersInfo = await getPlanespottersInfo(targetRegistration);
      console.log(`API: Planespotters result:`, planespottersInfo);
      // Ustaw photoUrl tylko jeśli nie jest już ustawione
      if (planespottersInfo.photoUrl) {
        aircraftInfo.photoUrl = planespottersInfo.photoUrl;
      }
      // Pozostałe dane z Planespotters
      aircraftInfo = { ...aircraftInfo, ...planespottersInfo, photoUrl: aircraftInfo.photoUrl };
      
      // Następnie próbuj inne źródła, ale nie nadpisuj photoUrl jeśli już jest
      console.log(`API: Trying Supabase for registration: ${targetRegistration}`);
      const supabaseInfo = await getSupabaseAircraftInfo(targetRegistration);
      console.log(`API: Supabase result:`, supabaseInfo);
      // Nie nadpisuj photoUrl jeśli już jest
      aircraftInfo = { ...aircraftInfo, ...supabaseInfo, photoUrl: aircraftInfo.photoUrl };
      
      if (process.env.FLIGHTAWARE_API_KEY) {
        console.log(`API: Trying FlightAware for registration: ${targetRegistration}`);
        const flightAwareInfo = await getFlightAwareInfo(targetRegistration);
        console.log(`API: FlightAware result:`, flightAwareInfo);
        aircraftInfo = { ...aircraftInfo, ...flightAwareInfo, photoUrl: aircraftInfo.photoUrl };
      }
      if (process.env.AVIATIONSTACK_API_KEY) {
        console.log(`API: Trying Aviation Stack for registration: ${targetRegistration}`);
        const aviationStackInfo = await getAviationStackInfo(targetRegistration);
        console.log(`API: Aviation Stack result:`, aviationStackInfo);
        aircraftInfo = { ...aircraftInfo, ...aviationStackInfo, photoUrl: aircraftInfo.photoUrl };
      }
    }
    
    // Determine aircraft category based on model
    aircraftInfo.category = getAircraftCategory(aircraftInfo.model);
    
    // Save to cache
    apiCache.set(cacheKey, {
      data: aircraftInfo,
      timestamp: Date.now(),
    });
    
    return NextResponse.json({
      success: true,
      data: aircraftInfo,
      cached: false,
      sources: {
        opensky: !!icao24,
        planespotters: !!targetRegistration,
        supabase: !!targetRegistration,
        flightaware: !!process.env.FLIGHTAWARE_API_KEY,
        aviationstack: !!process.env.AVIATIONSTACK_API_KEY,
      },
    });
    
  } catch (error) {
    console.error('Error fetching aircraft info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch aircraft information' },
      { status: 500 }
    );
  }
} 