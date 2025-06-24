'use client';

import { useState, useEffect } from 'react';
import { FiFilter, FiX } from 'react-icons/fi';
import { AirportFilterType } from '../types';
import { FlightFilters } from './ClientMap';

interface FilterPanelProps {
  airportFilter: AirportFilterType;
  onAirportFilterChange: (newFilter: AirportFilterType) => void;
  flightFilters: FlightFilters;
  onFlightFilterChange: (newFilters: FlightFilters) => void;
}

export default function FilterPanel({ airportFilter, onAirportFilterChange, flightFilters, onFlightFilterChange }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false); // Default to closed on mobile

  // Check if we're on mobile and set initial state
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (!isMobile) {
      setIsOpen(true); // Open by default on desktop
    }
  }, []);

  const handleAirportFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onAirportFilterChange(event.target.value as AirportFilterType);
  };

  const handleFlightFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = event.target;
    onFlightFilterChange({
      ...flightFilters,
      [name]: type === 'checkbox' ? checked : parseInt(value, 10),
    });
  };

  const FT_IN_M = 3.28084;

  return (
    <>
      {/* Toggle Button - positioned above legend button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute bottom-16 right-4 z-[1001] p-3 bg-white rounded-full shadow-lg text-gray-700 hover:bg-gray-100 transition-all"
        aria-label={isOpen ? "Close filters" : "Open filters"}
      >
        {isOpen ? <FiX size={20} /> : <FiFilter size={20} />}
      </button>

      {/* Sliding Panel */}
      <div
        className={`absolute top-0 right-0 h-full bg-white shadow-2xl z-[999] p-4 md:p-6 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } w-72 md:w-80 overflow-y-auto`}
      >
        <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6 mt-4 md:mt-6">Map Filters</h2>
        
        {/* Airport Filters */}
        <div className="space-y-4 border-b pb-4 mb-4">
          <p className="font-semibold text-gray-700">Airport Types</p>
          <div className="flex flex-col space-y-2">
            <label className="flex items-center space-x-3">
              <input
                type="radio"
                name="airportFilter"
                value="all"
                checked={airportFilter === 'all'}
                onChange={handleAirportFilterChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span>Show All Airports</span>
            </label>
            <label className="flex items-center space-x-3">
              <input
                type="radio"
                name="airportFilter"
                value="main"
                checked={airportFilter === 'main'}
                onChange={handleAirportFilterChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span>Show Main Airports Only</span>
            </label>
          </div>
          <p className="text-xs text-gray-500 pt-1">
            'Main airports' are those with an IATA code.
          </p>
        </div>

        {/* Aircraft Filters */}
        <div className="space-y-4">
          <p className="font-semibold text-gray-700">Aircraft Filters</p>
          <div className="flex flex-col space-y-2">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                name="hideOnGround"
                checked={flightFilters.hideOnGround}
                onChange={handleFlightFilterChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span>Hide aircraft on ground</span>
            </label>
          </div>
          
          {/* Altitude Filter */}
          <div className="space-y-2 pt-2">
            <label htmlFor="minAltitude" className="font-medium text-gray-600">
              Min. Altitude: {flightFilters.minAltitude.toLocaleString()} ft
            </label>
            <input
              type="range"
              id="minAltitude"
              name="minAltitude"
              min="0"
              max="50000"
              step="1000"
              value={flightFilters.minAltitude}
              onChange={handleFlightFilterChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0 ft</span>
              <span>50,000 ft</span>
            </div>
          </div>
        </div>

        {/* Display Options */}
        <div className="space-y-4 border-t pt-4 mt-4">
          <p className="font-semibold text-gray-700">Display Options (Hover to show)</p>
          <div className="flex flex-col space-y-3">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                name="showLabels"
                checked={flightFilters.showLabels}
                onChange={handleFlightFilterChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span>Show flight info on hover</span>
            </label>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                name="showAirlineLogos"
                checked={flightFilters.showAirlineLogos}
                onChange={handleFlightFilterChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span>Show airline logos</span>
            </label>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                name="showFlightNumbers"
                checked={flightFilters.showFlightNumbers}
                onChange={handleFlightFilterChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span>Show flight numbers</span>
            </label>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                name="showAltitude"
                checked={flightFilters.showAltitude}
                onChange={handleFlightFilterChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span>Show altitude</span>
            </label>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                name="showSpeed"
                checked={flightFilters.showSpeed}
                onChange={handleFlightFilterChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span>Show speed</span>
            </label>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                name="autoFetchAircraftInfo"
                checked={flightFilters.autoFetchAircraftInfo}
                onChange={handleFlightFilterChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span>Auto-fetch aircraft details (loads on hover when disabled)</span>
            </label>
          </div>
        </div>

      </div>
    </>
  );
} 