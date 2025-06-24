'use client'

import { useEffect, useState, useRef } from 'react'; // <--- FIX: Added useEffect import
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FlightState, Airport, FlightTrackPoint, BoundingBox, FlightRouteInfo } from '../types';
import { FlightFilters } from './ClientMap';
import MapControls from './MapControls';
import { useRouter } from 'next/navigation';

// Fix for default icon issue with Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Custom airplane icon with different sizes and arrows based on vertical speed
const airplaneIcon = (rotation: number, flight: FlightState) => {
  let size = 24; // default size
  let arrowDirection = 'none'; // default no arrow
  let arrowColor = '#3b82f6'; // default blue

  // Check if we have cached aircraft info
  const cachedInfo = aircraftCache.get(flight.icao24);
  if (cachedInfo) {
    // Set size based on category
    switch (cachedInfo.category) {
      case 'A5': // Heavy commercial jets
        size = 36;
        break;
      case 'A3': // Medium commercial jets (Boeingi i Airbusy)
        size = 32;
        break;
      case 'A2': // Regional jets (Embraer, Bombardier, ATR)
        size = 24;
        break;
      case 'A1': // Small aircraft
        size = 20;
        break;
      case 'B1': // Helicopters
        size = 18;
        break;
      default:
        // Fallback to altitude-based sizing
        if (flight.baro_altitude) {
          const altitudeFeet = flight.baro_altitude * 3.28084;
          if (altitudeFeet > 35000) size = 36;
          else if (altitudeFeet > 25000) size = 32;
          else if (altitudeFeet > 15000) size = 28;
          else if (altitudeFeet > 5000) size = 24;
          else if (altitudeFeet > 1000) size = 20;
          else size = 18;
        }
    }
  } else {
    // No cached info, use altitude-based sizing
    if (flight.baro_altitude) {
      const altitudeFeet = flight.baro_altitude * 3.28084;
      if (altitudeFeet > 35000) size = 36;
      else if (altitudeFeet > 25000) size = 32;
      else if (altitudeFeet > 15000) size = 28;
      else if (altitudeFeet > 5000) size = 24;
      else if (altitudeFeet > 1000) size = 20;
      else size = 18;
    }
  }
  
  // Determine arrow direction based on vertical speed
  if (flight.vertical_rate !== null && flight.vertical_rate !== undefined) {
    const vsFeetPerMin = flight.vertical_rate * 196.85; // Convert m/s to ft/min
    
    if (vsFeetPerMin > 100) {
      arrowDirection = 'up';
      arrowColor = '#16a34a'; // green for climbing
    } else if (vsFeetPerMin < -100) {
      arrowDirection = 'down';
      arrowColor = '#dc2626'; // red for descending
    } else {
      arrowDirection = 'none'; // no arrow for near-zero V/S (-100 to +100 ft/min)
    }
  }

  // Create arrow SVG based on direction
  let arrowSvg = '';
  const arrowSize = Math.max(12, size * 0.4); // Smaller arrow, proportional to plane size
  
  if (arrowDirection === 'up') {
    arrowSvg = `<svg width="${arrowSize}" height="${arrowSize}" viewBox="0 0 24 24" fill="${arrowColor}">
      <path d="M12 2L4 10h3v8h10v-8h3L12 2z"/>
    </svg>`;
  } else if (arrowDirection === 'down') {
    arrowSvg = `<svg width="${arrowSize}" height="${arrowSize}" viewBox="0 0 24 24" fill="${arrowColor}">
      <path d="M12 22L20 14h-3V6H7v8H4L12 22z"/>
    </svg>`;
  }

  // Use airplane image with arrow beside it
  return new L.DivIcon({
    html: `<div style="position: relative; display: inline-block;">
            <img 
              src="/plane.png" 
              style="
                width: ${size}px; 
                height: ${size}px; 
                transform: rotate(${rotation}deg); 
                transform-origin: center;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
              "
            />
            ${arrowSvg ? `<div style="
              position: absolute; 
              top: ${size/2 - arrowSize/2}px; 
              left: ${size + 4}px; 
              width: ${arrowSize}px; 
              height: ${arrowSize}px; 
              display: flex; 
              align-items: center; 
              justify-content: center;
              pointer-events: none;
            ">${arrowSvg}</div>` : ''}
          </div>`,
    className: '',
    iconSize: [size + (arrowSvg ? arrowSize + 8 : 0), size],
    iconAnchor: [size/2, size/2]
  });
};

// Component to handle map events
const MapEvents = ({ onBoundsChange }: { onBoundsChange: (bounds: BoundingBox) => void; }) => {
  const map = useMap();

  const handleEvent = () => {
    // Check if map is properly initialized before getting bounds
    if (!map) {
      return;
    }
    
    try {
      const bounds = map.getBounds();
      onBoundsChange({
        lamin: bounds.getSouth(),
        lomin: bounds.getWest(),
        lamax: bounds.getNorth(),
        lomax: bounds.getEast()
      });
    } catch (error) {
      console.warn('Map bounds not available yet:', error);
    }
  };

  useMapEvents({
    moveend: handleEvent,
    zoomend: handleEvent
  });

  // Initial load - wait for map to be ready
  useEffect(() => {
    const timer = setTimeout(() => {
      if (map) {
        handleEvent();
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

// Function to get airline IATA code from callsign
const getAirlineIata = (callsign: string | null): string | null => {
  if (!callsign) return null;
  // The first 3 letters of a callsign are usually the airline's ICAO code
  const icao = callsign.substring(0, 3).toUpperCase();
  
  // Map ICAO to IATA codes
  const icaoToIata: { [key: string]: string } = {
    // Major European airlines
    'BAW': 'BA', 'DLH': 'LH', 'KLM': 'KL', 'AFR': 'AF', 'RYR': 'FR', 'WZZ': 'W6', 
    'EZY': 'U2', 'VY': 'VY', 'DY': 'DY', 'SK': 'SK', 'LX': 'LX', 'OS': 'OS', 
    'AY': 'AY', 'IB': 'IB', 'TP': 'TP', 'EI': 'EI', 'SN': 'SN', 'EW': 'EW',
    'LOT': 'LO', 'FIN': 'AY', 'AUA': 'OS', 'SWR': 'LX', 'SAS': 'SK', 'BEL': 'SN',
    'BTI': 'BT', 'CSA': 'OK', 'TAR': 'TU', 'TRA': 'HV', 'TUI': 'X3',
    'CFG': 'DE', 'EWG': 'EW', 'PGT': 'PC', 'GEC': 'GJ', 'KMM': 'KM',
    'ASL': 'ABR', 'BOX': 'BX', 'AFL': 'SU', 'ENT': 'E4',
    
    // Major US airlines
    'UAL': 'UA', 'AAL': 'AA', 'DAL': 'DL', 'SWA': 'WN', 'ASA': 'AS', 'JBU': 'B6',
    'FFT': 'F9', 'HAL': 'HA', 'JIA': '9W', 'NKS': 'NK', 'PDT': 'PDT', 'QXE': 'QX',
    'RPA': 'RP', 'SKW': 'OO', 'UCA': 'UA', 'UJC': 'UA', 'UJT': 'UA', 'UPS': '5X',
    'FDX': 'FX', 'ABX': 'GB', 'ATN': '8C', 'KZR': 'KC',
    
    // Middle East airlines
    'UAE': 'EK', 'QTR': 'QR', 'KAC': 'KU', 'MEA': 'ME', 'ROY': 'RJ', 'SVA': 'SV',
    'THY': 'TK', 'UAB': 'AB', 'IRA': 'IR', 'KIS': 'KQ', 'MSR': 'MS',
    
    // Asian airlines
    'THA': 'TG', 'CPA': 'CX', 'CES': 'MU', 'CCA': 'CA', 'CSN': 'CZ', 
    'JAL': 'JL', 'ANA': 'NH', 'KAL': 'KE', 'QFA': 'QF', 'JST': 'JD',
    'SIA': 'SQ', 'MAS': 'MH', 'GIA': 'GA', 'PAL': 'PR', 'VNA': 'VN',
    
    // African airlines
    'ETH': 'ET', 'KQ': 'KQ', 'RAM': 'AT', 'TUN': 'TU', 'SAW': 'SA', 'EGY': 'MS',
    'SAA': 'SA',
    
    // South American airlines
    'LAT': 'LA', 'GLO': 'G3', 'AZU': '2Z', 'LAN': 'LA', 'TAM': 'JJ', 'AVA': 'AV',
    
    // Canadian airlines
    'ACA': 'AC', 'WJA': 'WS', 'FAB': 'F8', 'JZA': 'QK', 'WEN': 'WG',
    
    // Australian airlines
    'RXP': 'JQ', 'VOZ': 'VA', 'TIG': 'TT',
    
    // Cargo airlines
    'DHL': 'D0', 'TNT': '3V', 'FED': 'FX'
  };
  
  return icaoToIata[icao] || null;
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

// Cache for aircraft information
const aircraftCache = new Map<string, { 
  model: string | null; 
  category: string;
  registration: string | null;
  manufacturer: string | null;
  owner: string | null;
  operator: string | null;
  yearBuilt: string | null;
  engineType: string | null;
  photoUrl: string | null;
}>();

// Load cache from localStorage on startup
const loadCacheFromStorage = () => {
  try {
    const cached = localStorage.getItem('aircraftCache');
    if (cached) {
      const parsed = JSON.parse(cached);
      Object.entries(parsed).forEach(([icao24, data]: [string, any]) => {
        aircraftCache.set(icao24, data);
      });
      console.log(`Loaded ${aircraftCache.size} aircraft from cache`);
    }
  } catch (error) {
    console.warn('Failed to load aircraft cache from localStorage:', error);
  }
};

// Save cache to localStorage
const saveCacheToStorage = () => {
  try {
    const cacheObj = Object.fromEntries(aircraftCache);
    localStorage.setItem('aircraftCache', JSON.stringify(cacheObj));
  } catch (error) {
    console.warn('Failed to save aircraft cache to localStorage:', error);
  }
};

// Load cache on module load
if (typeof window !== 'undefined') {
  loadCacheFromStorage();
}

// Debounce map for aircraft info requests
const pendingRequests = new Map<string, Promise<any>>();

// Semaphore to limit concurrent requests
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 20;

// Rate limiting
let requestCount = 0;
let lastResetTime = Date.now();
const MAX_REQUESTS_PER_MINUTE = 300;

// Function to get readable aircraft name from model code
const getReadableAircraftName = (model: string | null): string => {
  if (!model) return 'Unknown Aircraft';
  
  const modelUpper = model.toUpperCase().trim();
  
  // Airbus aircraft
  if (modelUpper.startsWith('A3')) {
    if (modelUpper.includes('A318')) return 'Airbus A318';
    if (modelUpper.includes('A319')) return 'Airbus A319';
    if (modelUpper.includes('A320')) return 'Airbus A320';
    if (modelUpper.includes('A321')) return 'Airbus A321';
    return 'Airbus A320 Family';
  }
  if (modelUpper.startsWith('A330')) return 'Airbus A330';
  if (modelUpper.startsWith('A340')) return 'Airbus A340';
  if (modelUpper.includes('A350')) return 'Airbus A350';
  if (modelUpper.startsWith('A380')) return 'Airbus A380';
  
  // Boeing aircraft
  if (modelUpper.startsWith('B73')) {
    if (modelUpper.includes('B737')) return 'Boeing 737';
    if (modelUpper.includes('B738')) return 'Boeing 737-800';
    if (modelUpper.includes('B739')) return 'Boeing 737-900';
    if (modelUpper.includes('B737')) return 'Boeing 737';
  }
  if (modelUpper.startsWith('B74')) return 'Boeing 747';
  if (modelUpper.startsWith('B75')) return 'Boeing 757';
  if (modelUpper.startsWith('B76')) return 'Boeing 767';
  if (modelUpper.startsWith('B77')) return 'Boeing 777';
  if (modelUpper.startsWith('B78')) return 'Boeing 787';
  
  // Embraer aircraft
  if (modelUpper.startsWith('E1')) {
    if (modelUpper.includes('E170')) return 'Embraer E170';
    if (modelUpper.includes('E175')) return 'Embraer E175';
    if (modelUpper.includes('E190')) return 'Embraer E190';
    if (modelUpper.includes('E195')) return 'Embraer E195';
  }
  if (modelUpper.startsWith('E2')) {
    if (modelUpper.includes('E275')) return 'Embraer E175-E2';
    if (modelUpper.includes('E290')) return 'Embraer E190-E2';
    if (modelUpper.includes('E295')) return 'Embraer E195-E2';
  }
  
  // Bombardier/CRJ
  if (modelUpper.includes('CRJ')) {
    if (modelUpper.includes('CRJ1')) return 'Bombardier CRJ100';
    if (modelUpper.includes('CRJ2')) return 'Bombardier CRJ200';
    if (modelUpper.includes('CRJ7')) return 'Bombardier CRJ700';
    if (modelUpper.includes('CRJ9')) return 'Bombardier CRJ900';
    return 'Bombardier CRJ';
  }
  
  // ATR
  if (modelUpper.includes('ATR')) {
    if (modelUpper.includes('ATR42')) return 'ATR 42';
    if (modelUpper.includes('ATR72')) return 'ATR 72';
    return 'ATR';
  }
  
  // Dash 8/Q400
  if (modelUpper.includes('DASH8') || modelUpper.includes('Q400')) return 'Bombardier Dash 8';
  
  // Saab
  if (modelUpper.includes('SAAB')) return 'Saab 340';
  
  // Fokker
  if (modelUpper.includes('FOKKER')) return 'Fokker';
  
  // McDonnell Douglas
  if (modelUpper.includes('MD80') || modelUpper.includes('MD81') || modelUpper.includes('MD82') || 
      modelUpper.includes('MD83') || modelUpper.includes('MD87') || modelUpper.includes('MD88')) {
    return 'McDonnell Douglas MD-80';
  }
  if (modelUpper.includes('MD90')) return 'McDonnell Douglas MD-90';
  
  // Small aircraft
  if (modelUpper.includes('CESSNA')) return 'Cessna';
  if (modelUpper.includes('PIPER')) return 'Piper';
  if (modelUpper.includes('BEECHCRAFT')) return 'Beechcraft';
  if (modelUpper.includes('CIRRUS')) return 'Cirrus';
  if (modelUpper.includes('DIAMOND')) {
    if (modelUpper.includes('DA40')) return 'Diamond DA40';
    if (modelUpper.includes('DA42')) return 'Diamond DA42';
    if (modelUpper.includes('DA62')) return 'Diamond DA62';
    return 'Diamond';
  }
  if (modelUpper.includes('ROBIN')) return 'Robin';
  
  // Helicopters
  if (modelUpper.includes('HELICOPTER') || modelUpper.includes('ROTORCRAFT')) return 'Helicopter';
  if (modelUpper.includes('H125') || modelUpper.includes('AS350')) return 'Airbus H125';
  if (modelUpper.includes('H135') || modelUpper.includes('EC135')) return 'Airbus H135';
  if (modelUpper.includes('H145') || modelUpper.includes('EC145')) return 'Airbus H145';
  if (modelUpper.includes('H175') || modelUpper.includes('EC175')) return 'Airbus H175';
  if (modelUpper.includes('AW139')) return 'Leonardo AW139';
  if (modelUpper.includes('AW169')) return 'Leonardo AW169';
  if (modelUpper.includes('AW189')) return 'Leonardo AW189';
  
  return model; // Return original if no match found
};

// Function to determine aircraft category based on model
const getAircraftCategory = (model: string | null): string => {
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
};

// Function to get aircraft info with caching - now using our integrated API
const getAircraftInfo = async (icao24: string, callsign: string | null, flight: FlightState, autoFetch: boolean = true) => {
  if (aircraftCache.has(icao24)) {
    return aircraftCache.get(icao24)!;
  }
  
  // Check if request is already pending
  if (pendingRequests.has(icao24)) {
    // Wait for existing request
    try {
      await pendingRequests.get(icao24);
      return aircraftCache.get(icao24) || { 
        model: null, 
        category: 'unknown',
        registration: null,
        manufacturer: null,
        owner: null,
        operator: null,
        yearBuilt: null,
        engineType: null,
        photoUrl: null,
      };
    } catch (error) {
      console.warn(`Error waiting for aircraft info for ${icao24}:`, error);
    }
  }
  
  // Don't fetch immediately - return fallback and fetch in background
  const fallback = { 
    model: null, 
    category: 'unknown',
    registration: null,
    manufacturer: null,
    owner: null,
    operator: null,
    yearBuilt: null,
    engineType: null,
    photoUrl: null,
  };
  
  // Set fallback in cache immediately
  aircraftCache.set(icao24, fallback);
  
  // Only fetch if auto-fetch is enabled
  if (!autoFetch) {
    return fallback;
  }
  
  // Create pending request with semaphore
  const requestPromise = (async () => {
    // Check rate limit - temporarily disabled for faster loading
    // const now = Date.now();
    // if (now - lastResetTime > 60000) { // 1 minute
    //   requestCount = 0;
    //   lastResetTime = now;
    // }
    
    // if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    //   console.warn('Rate limit reached, skipping aircraft info request');
    //   return;
    // }
    
    // Wait if too many concurrent requests
    while (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      await new Promise(resolve => setTimeout(resolve, 10)); // Minimal delay
    }
    
    // Remove delay completely for immediate response
    // const delay = flight.callsign ? 50 : 200;
    // await new Promise(resolve => setTimeout(resolve, delay));
    
    activeRequests++;
    requestCount++;
    
    // Only log for commercial flights to reduce noise
    // if (flight.callsign) {
    //   console.log(`Fetching info for ${flight.callsign} (${requestCount}/${MAX_REQUESTS_PER_MINUTE} requests/min)`);
    // }
    
    try {
      const params = new URLSearchParams();
      params.append('icao24', icao24.toLowerCase());
      if (callsign) {
        params.append('callsign', callsign);
      }
      
      const response = await fetch(`/api/aircraft-info?${params.toString()}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const aircraftData = result.data;
        
        // Create full model name with manufacturer
        let fullModelName = null;
        if (aircraftData.model) {
          if (aircraftData.manufacturer && aircraftData.manufacturer !== aircraftData.model) {
            fullModelName = `${aircraftData.manufacturer} ${aircraftData.model}`;
          } else {
            fullModelName = aircraftData.model;
          }
        }
        
        const category = aircraftData.category || 'unknown';
        
        console.log(`MapView: Got aircraft data for ${icao24}:`, {
          model: aircraftData.model,
          manufacturer: aircraftData.manufacturer,
          fullModelName,
          registration: aircraftData.registration,
          category,
          sources: result.sources
        });
        
        const aircraftInfo = { 
          model: fullModelName, 
          category,
          registration: aircraftData.registration,
          manufacturer: aircraftData.manufacturer,
          owner: aircraftData.owner,
          operator: aircraftData.operator,
          yearBuilt: aircraftData.yearBuilt,
          engineType: aircraftData.engineType,
          photoUrl: aircraftData.photoUrl,
        };
        
        // Update cache with real data
        aircraftCache.set(icao24, aircraftInfo);
        
        // Save to localStorage
        saveCacheToStorage();
      } else {
        console.log(`MapView: No aircraft data for ${icao24}:`, result);
      }
    } catch (error) {
      console.warn(`Failed to get aircraft info for ${icao24}:`, error);
    } finally {
      activeRequests--;
    }
  })();
  
  // Store pending request
  pendingRequests.set(icao24, requestPromise);
  
  // Clean up pending request after completion
  requestPromise.finally(() => {
    pendingRequests.delete(icao24);
  });
  
  return fallback;
};

// Function to create flight label
const createFlightLabel = (flight: FlightState, filters: FlightFilters, aircraftInfoState: {[icao24: string]: string}, updateAircraftInfo: (icao24: string, aircraftType: string) => void) => {
  if (!filters.showLabels) return null;
  
  const parts: string[] = [];
  
  // Add airline logo
  if (filters.showAirlineLogos && flight.callsign) {
    const iata = getAirlineIata(flight.callsign);
    if (iata) {
      parts.push(`<img src="https://www.gstatic.com/flights/airline_logos/70px/${iata}.png" 
                   style="width: 20px; height: 20px; vertical-align: middle; margin-right: 4px;" 
                   onerror="this.style.display='none';" />`);
    }
  }
  
  // Add flight number
  if (filters.showFlightNumbers && flight.callsign) {
    parts.push(`<span style="font-weight: bold; color: #1f2937;">${flight.callsign}</span>`);
  }
  
  // Add aircraft type if available
  const cachedInfo = aircraftCache.get(flight.icao24);
  const stateInfo = aircraftInfoState[flight.icao24];
  
  // Try to get aircraft type from cache
  let aircraftType = null;
  
  if (stateInfo) {
    aircraftType = stateInfo;
  } else if (cachedInfo && cachedInfo.model) {
    aircraftType = getShortAircraftCode(cachedInfo.model);
  }
  
  if (aircraftType) {
    parts.push(`<span style="color: #7c3aed; font-size: 10px;">${aircraftType}</span>`);
  }
  
  // Add altitude
  if (filters.showAltitude && flight.baro_altitude) {
    const altitudeFeet = Math.round(flight.baro_altitude * 3.28084);
    parts.push(`<span style="color: #059669;">${altitudeFeet.toLocaleString()} ft</span>`);
  }
  
  // Add speed
  if (filters.showSpeed && flight.velocity) {
    const speedKnots = Math.round(flight.velocity * 1.94384);
    parts.push(`<span style="color: #dc2626;">${speedKnots} kt</span>`);
  }
  
  if (parts.length === 0) return null;
  
  return `<div style="
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    z-index: 1000;
  ">${parts.join(' ')}</div>`;
};

interface MapViewProps {
  flights: FlightState[];
  airports: Airport[];
  center: [number, number];
  zoom?: number;
  onBoundsChange: (bounds: BoundingBox) => void;
  onFlightClick: (flight: FlightState) => void;
  onPopupClose: () => void;
  selectedTrack: FlightTrackPoint[] | null;
  selectedFlightIcao: string | null;
  isPopupOpen: boolean;
  selectedFlightRoute: FlightRouteInfo | null;
  isFlightDetailsLoading: boolean;
  flightFilters: FlightFilters;
  mapCenter?: { lat: number; lng: number };
}

const MapView = ({ 
  flights, airports, center, zoom = 7, onBoundsChange, onFlightClick, onPopupClose, 
  selectedTrack, selectedFlightIcao, isPopupOpen, selectedFlightRoute, isFlightDetailsLoading, flightFilters, mapCenter 
}: MapViewProps) => {
  const router = useRouter();
  const [aircraftInfoState, setAircraftInfoState] = useState<{[icao24: string]: string}>({});
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isLegendVisible, setIsLegendVisible] = useState(false); // Default to hidden on mobile
  const hasLoggedStatus = useRef(false);
  const hasLoggedAircraftCount = useRef(false);
  const isMounted = useRef(true);
  const mapId = useRef(`map-${Date.now()}-${Math.random()}`);

  // Check if we're on mobile and set initial legend state
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setIsLegendVisible(true); // Show by default on desktop
    }
  }, []);

  // Function to update aircraft info state
  const updateAircraftInfo = (icao24: string, aircraftType: string) => {
    if (!isMounted.current) return;
    setAircraftInfoState(prev => ({
      ...prev,
      [icao24]: aircraftType
    }));
  };

  // Function to handle hover with debouncing
  const handleHover = (flight: FlightState) => {
    if (!isMounted.current) return;
    
    // Clear existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    
    // Fetch immediately without delay
    if (!flightFilters.autoFetchAircraftInfo && 
        !aircraftCache.has(flight.icao24) && 
        flight.callsign) {
      // console.log(`Hover: Loading details for ${flight.callsign}`);
      getAircraftInfo(flight.icao24, flight.callsign, flight, true);
    }
  };

  // Function to preload aircraft info for all commercial flights
  const preloadCommercialAircraft = () => {
    if (flightFilters.autoFetchAircraftInfo) return;
    
    const commercialFlights = flights.filter(f => f.callsign && !aircraftCache.has(f.icao24));
    // console.log(`Preloading data for ${commercialFlights.length} commercial flights`);
    
    commercialFlights.slice(0, 10).forEach(flight => { // Limit to first 10 to avoid overwhelming
      getAircraftInfo(flight.icao24, flight.callsign, flight, true);
    });
  };

  // Function to preload aircraft info for flights near map center
  const preloadCenterAircraft = () => {
    if (flightFilters.autoFetchAircraftInfo || !mapCenter) return;
    
    const centerLat = mapCenter.lat;
    const centerLng = mapCenter.lng;
    const radius = 2; // degrees
    
    const nearbyFlights = flights.filter(f => 
      f.callsign && 
      !aircraftCache.has(f.icao24) &&
      Math.abs(f.latitude - centerLat) < radius &&
      Math.abs(f.longitude - centerLng) < radius
    );
    
    // Preload closest 5 flights to center
    const sortedByDistance = nearbyFlights.sort((a, b) => {
      const distA = Math.sqrt(Math.pow(a.latitude - centerLat, 2) + Math.pow(a.longitude - centerLng, 2));
      const distB = Math.sqrt(Math.pow(b.latitude - centerLat, 2) + Math.pow(b.longitude - centerLng, 2));
      return distA - distB;
    });
    
    sortedByDistance.slice(0, 5).forEach(flight => {
      getAircraftInfo(flight.icao24, flight.callsign, flight, true);
    });
  };

  // Monitor cache changes and update state
  useEffect(() => {
    const checkCacheUpdates = () => {
      if (!isMounted.current) return;
      
      const newState: {[icao24: string]: string} = {};
      let hasChanges = false;
      
      flights.forEach(flight => {
        const cachedInfo = aircraftCache.get(flight.icao24);
        if (cachedInfo && cachedInfo.model) {
          const aircraftType = getShortAircraftCode(cachedInfo.model);
          newState[flight.icao24] = aircraftType;
          
          // Check if this is a new aircraft type
          if (aircraftInfoState[flight.icao24] !== aircraftType) {
            hasChanges = true;
          }
        }
      });
      
      // Only update state if there are actual changes
      if (hasChanges && isMounted.current) {
        setAircraftInfoState(newState);
      }
    };

    // Check immediately
    checkCacheUpdates();
    
    // Log auto-fetch status only once when it changes
    if (!hasLoggedStatus.current && isMounted.current) {
      console.log(`Auto-fetch aircraft info: ${flightFilters.autoFetchAircraftInfo ? 'ENABLED' : 'DISABLED (hover to load)'}`);
      hasLoggedStatus.current = true;
    }
    
    // Log aircraft info only once
    if (!hasLoggedAircraftCount.current && isMounted.current) {
      const commercialFlights = flights.filter(f => f.callsign).length;
      const totalFlights = flights.length;
      console.log(`Aircraft on map: ${totalFlights} total, ${commercialFlights} with flight numbers`);
      hasLoggedAircraftCount.current = true;
      
      // Preload data for commercial flights
      setTimeout(() => {
        if (isMounted.current) {
          preloadCommercialAircraft();
        }
      }, 1000);
      // Preload data for flights near center
      setTimeout(() => {
        if (isMounted.current) {
          preloadCenterAircraft();
        }
      }, 1500);
    }
    
    // Set up interval to check for cache updates (more frequent for faster updates)
    const intervalId = setInterval(checkCacheUpdates, 1000); // Changed from 5000 to 1000ms
    
    return () => {
      clearInterval(intervalId);
      // Clean up hover timeout
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [flights, hoverTimeout, flightFilters.autoFetchAircraftInfo, aircraftInfoState]);

  // Reset logging when auto-fetch setting changes
  useEffect(() => {
    hasLoggedStatus.current = false;
  }, [flightFilters.autoFetchAircraftInfo]);

  // Reset aircraft count logging when flights change
  useEffect(() => {
    hasLoggedAircraftCount.current = false;
  }, [flights.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
    <MapContainer 
      center={center} 
      zoom={zoom} 
      style={{ height: '100%', width: '100%' }} 
      scrollWheelZoom={true}
      key={mapId.current}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents onBoundsChange={onBoundsChange} />
      <MapControls />

      {airports.map(airport => (
        <Marker key={airport.icao} position={[airport.lat, airport.lon]}>
          <Popup>{airport.name}</Popup>
        </Marker>
      ))}

        {flights.map(flight => {
          const label = createFlightLabel(flight, flightFilters, aircraftInfoState, updateAircraftInfo);
          const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
          
          return (
        <Marker 
          key={flight.icao24} 
          position={[flight.latitude, flight.longitude]}
              icon={airplaneIcon(flight.true_track || 0, flight)}
              eventHandlers={{ 
                click: () => {
                  onFlightClick(flight);
                },
                mouseover: () => {
                  if (!isMobile) {
                    handleHover(flight);
                  }
                }
              }}
            >
              {/* Show popup on mobile, tooltip on desktop */}
              {isMobile ? (
                <Popup>
                  <div className="w-48">
                    <h3 className="font-bold text-lg mb-2">{flight.callsign || 'Unknown'}</h3>
                    {label && (
                      <div className="mb-3" dangerouslySetInnerHTML={{ __html: label }} />
                    )}
                    <button 
                      className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-600 transition-colors" 
                      onClick={() => {
                        console.log('MapView: Navigating to details for ICAO24:', flight.icao24);
                        router.push(`/details/${flight.icao24}`);
                      }}
                    >
                      Details &rarr;
                    </button>
                  </div>
                </Popup>
              ) : (
                label && (
                  <Tooltip 
                    direction="right"
                    offset={[10, 0]}
                    className="flight-label-tooltip"
                  >
                    <div>
                      <div dangerouslySetInnerHTML={{ __html: label }} />
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <button 
                          className="text-blue-500 hover:text-blue-700 text-xs font-medium" 
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('MapView: Navigating to details for ICAO24:', flight.icao24);
                            router.push(`/details/${flight.icao24}`);
                          }}
                        >
                          Details &rarr;
                        </button>
                      </div>
                    </div>
                  </Tooltip>
                )
              )}
              
              {selectedFlightIcao === flight.icao24 && !isMobile && (
                <Popup>
              <div className="w-48">
                <h3 className="font-bold text-lg">{flight.callsign || 'Unknown'}</h3>
                {isFlightDetailsLoading ? (
                  <p>Loading details...</p>
                ) : (
                  <>
                    {selectedFlightRoute ? (
                      <p>
                        Route: {selectedFlightRoute.departureAirport} to {selectedFlightRoute.arrivalAirport}
                      </p>
                    ) : (
                      <p>Route information not available.</p>
                    )}
                    <button 
                      className="text-blue-500 hover:underline mt-2" 
                          onClick={() => {
                            console.log('MapView: Navigating to details for ICAO24:', flight.icao24);
                            router.push(`/details/${flight.icao24}`);
                          }}
                    >
                      Details &rarr;
                    </button>
                  </>
                )}
              </div>
            </Popup>
          )}
        </Marker>
          );
        })}

      {selectedTrack && (
        <Polyline pathOptions={{ color: 'orange' }} positions={selectedTrack.map(p => [p.latitude, p.longitude])} />
      )}
    </MapContainer>
      
      {/* Legend Toggle Button */}
      <button
        onClick={() => setIsLegendVisible(!isLegendVisible)}
        className="absolute bottom-4 right-4 z-[1001] p-2 bg-white rounded-full shadow-lg text-gray-700 hover:bg-gray-100 transition-all"
        style={{ 
          bottom: isLegendVisible ? (window.innerWidth < 768 ? '240px' : '280px') : '20px',
          right: '20px',
          fontSize: window.innerWidth < 768 ? '14px' : '16px'
        }}
        aria-label={isLegendVisible ? "Hide legend" : "Show legend"}
      >
        {isLegendVisible ? '✕' : 'ℹ️'}
      </button>

      {/* Legend */}
      {isLegendVisible && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          fontSize: '11px',
          maxWidth: window.innerWidth < 768 ? '160px' : '200px',
          zIndex: 1000
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '12px' }}>Legend</h4>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontWeight: 'bold' }}>Large (36px)</span> - Heavy jets
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontWeight: 'bold' }}>Medium (30-32px)</span> - Heavy aircraft
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontWeight: 'bold' }}>Standard (24px)</span> - Medium aircraft
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontWeight: 'bold' }}>Small (18-22px)</span> - Light aircraft
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontWeight: 'bold' }}>Tiny (14-16px)</span> - Gliders & UAVs
          </div>
          <div style={{ marginTop: '8px', fontSize: '10px' }}>
            <div>Border color = altitude:</div>
            <div style={{ color: '#dc2626' }}>🔴 High (&gt;35k ft)</div>
            <div style={{ color: '#ea580c' }}>🟠 Medium-high (25k-35k ft)</div>
            <div style={{ color: '#ca8a04' }}>🟡 Medium (15k-25k ft)</div>
            <div style={{ color: '#16a34a' }}>🟢 Low-medium (5k-15k ft)</div>
            <div style={{ color: '#0891b2' }}>🔵 Low (&lt;5k ft)</div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '10px', color: '#6b7280' }}>
            💡 Hover for details
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;