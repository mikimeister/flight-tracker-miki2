'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import React from 'react';
import ReactDOMServer from 'react-dom/server';

// This is a well-known hack to fix the icon path issue with Leaflet in Next.js.
// We delete the default prototype's method for getting the icon URL and then
// merge the options with the correct paths using `require`, which is more reliable here.
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface FlightMapProps {
  latitude: number;
  longitude: number;
  callsign: string;
  true_track: number | null; // Heading in degrees
}

const FlightMap = ({ latitude, longitude, callsign, true_track }: FlightMapProps) => {
  if (typeof window === 'undefined') {
    return null;
  }

  // Use the user's PNG icon with better styling
  const customIcon = L.divIcon({
    html: `<img 
            src="/plane.png" 
            style="
              width: 32px; 
              height: 32px; 
              transform: rotate(${true_track || 0}deg); 
              transform-origin: center;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
            "
          />`,
    className: 'bg-transparent', // Remove leaflet's default background
    iconSize: [32, 32],
    iconAnchor: [16, 16], // Center the icon
  });

  return (
    <MapContainer 
      center={[latitude, longitude]} 
      zoom={8} 
      scrollWheelZoom={false} 
      style={{ height: '400px', width: '100%', borderRadius: '12px' }}
      key={`flight-map-${latitude}-${longitude}-${callsign}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitude, longitude]} icon={customIcon}>
        <Popup>
          {callsign}
        </Popup>
      </Marker>
    </MapContainer>
  )
}

export default FlightMap 