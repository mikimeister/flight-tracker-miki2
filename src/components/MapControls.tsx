'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Define different tile layers
const tileLayers = {
  Street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }),
  Satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
  }),
  Topographic: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)'
  }),
};

const overlayLayers = {
  'City Labels': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; Cartoon',
      pane: 'shadowPane'
  })
};

const MapControls = () => {
  const map = useMap();

  useEffect(() => {
    // Add base layers and default to Street
    tileLayers.Street.addTo(map);
    const layerControl = L.control.layers(tileLayers, overlayLayers).addTo(map);

    // Custom "locate me" control
    const locateControl = L.Control.extend({
        onAdd: () => {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            container.innerHTML = `<a href="#" title="Show my location" role="button" style="font-size: 1.5rem; line-height: 2rem; width: 30px; height: 30px; display: block; text-align: center; background-color: white; color: black; text-decoration: none;">📍</a>`;
            container.style.cursor = 'pointer';
            
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.on(container, 'click', (e) => {
                e.preventDefault();
                map.locate();
            });
            return container;
        },
    });
    const customLocateControl = new locateControl({ position: 'topright' });
    customLocateControl.addTo(map);
    
    // Handlers for location events
    const onLocationFound = (e: L.LocationEvent) => {
        map.flyTo(e.latlng, 13);
    }
    const onLocationError = (e: L.ErrorEvent) => {
        alert("Could not find your location. Please check your browser permissions.");
        console.error(e.message);
    }

    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);

    return () => {
      // Cleanup
      map.removeControl(layerControl);
      map.removeControl(customLocateControl);
      map.off('locationfound', onLocationFound);
      map.off('locationerror', onLocationError);
    };
  }, [map]);

  return null;
};

export default MapControls; 