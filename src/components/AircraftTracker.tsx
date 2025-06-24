'use client'

import { useState, useEffect, useCallback } from 'react'
import { Session } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import { FiLoader, FiCheckCircle, FiXCircle, FiInfo, FiBell, FiBellOff } from 'react-icons/fi';
import Link from 'next/link';

type TrackedItem = {
  id: number
  type: 'REGISTRATION' | 'FLIGHT_NUMBER'
  value: string
  notify_on_land: boolean
}

type FlightStatus = {
  on_ground: boolean
  origin_country: string
  callsign: string
  icao24: string
}

// A small component for status pills
const StatusPill = ({ status }: { status: FlightStatus | undefined }) => {
  if (!status) {
    return <div className="flex items-center gap-2 text-sm text-gray-500"><FiInfo /> Status Unavailable</div>;
  }
  if (status.on_ground) {
    return <div className="flex items-center gap-2 text-sm text-blue-600 font-semibold"><FiCheckCircle /> On the Ground</div>;
  }
  return <div className="flex items-center gap-2 text-sm text-green-600 font-semibold"><FiLoader className="animate-spin" /> In the Air</div>;
}

export default function AircraftTracker({ session }: { session: Session }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadingStatuses, setLoadingStatuses] = useState(false)
  const [itemList, setItemList] = useState<TrackedItem[]>([])
  const [statuses, setStatuses] = useState<{ [key: string]: FlightStatus }>({})
  const [newItemValue, setNewItemValue] = useState('')
  const [newItemType, setNewItemType] = useState<'REGISTRATION' | 'FLIGHT_NUMBER'>('REGISTRATION')
  const [diagnostics, setDiagnostics] = useState<{ totalStatesReceived: number, timestamp: string } | null>(null)
  const user = session.user

  const getFlightStatuses = useCallback(async (items: TrackedItem[]) => {
    if (items.length === 0) return;
    
    setLoadingStatuses(true);
    try {
      const itemValues = items.map(item => item.value);

      const response = await fetch('/api/flight-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: itemValues }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch statuses');
      }

      const data = await response.json();
      setStatuses(data.statuses || {});
      if (data.diagnostics) {
        setDiagnostics(data.diagnostics);
      }
    } catch (error: any) {
      console.error('Error fetching statuses:', error.message);
    } finally {
      setLoadingStatuses(false);
    }
  }, []); // Empty dependency array ensures the function is created only once

  const getTrackedItems = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error, status } = await supabase
        .from('tracked_items')
        .select(`id, value, type, notify_on_land`)
        .eq('user_id', user.id)

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        setItemList(data)
        if (data.length > 0) {
            getFlightStatuses(data);
        }
      }
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }, [user.id, supabase, getFlightStatuses])

  useEffect(() => {
    getTrackedItems()
  }, [getTrackedItems])

  // Auto-refresh logic
  useEffect(() => {
    // Don't start the timer if the list is empty
    if (itemList.length === 0) {
      return;
    }

    // Set an interval to refresh statuses every 60 seconds
    const interval = setInterval(() => {
      console.log("Auto-refreshing statuses...");
      getFlightStatuses(itemList);
    }, 60000); // 60000 ms = 1 minute

    // Clear the interval when the component unmounts or the item list changes
    return () => clearInterval(interval);
  }, [itemList, getFlightStatuses]); // Rerun effect if itemList changes

  async function handleAddItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setLoading(true)
      const value = newItemValue.trim().toUpperCase()
      if (!value) throw new Error("Value cannot be empty")

      const { error } = await supabase
        .from('tracked_items')
        .insert({ user_id: user.id, type: newItemType, value: value })
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('You are already tracking this item.')
        }
        throw error
      }

      setNewItemValue('')
      await getTrackedItems()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteItem(id: number) {
    try {
      setLoading(true)
      const { error } = await supabase
        .from('tracked_items')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      await getTrackedItems()
    } catch (error) {
      alert('Error deleting item!')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleNotify(id: number, currentValue: boolean) {
    try {
      const { error } = await supabase
        .from('tracked_items')
        .update({ notify_on_land: !currentValue })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error;

      setItemList(currentList =>
        currentList.map(item =>
          item.id === id ? { ...item, notify_on_land: !currentValue } : item
        )
      );
    } catch (error: any) {
      alert('Error updating notification preference: ' + error.message);
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6">
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">Track New Item</h2>
        <p className="text-sm text-gray-500 mt-1">Add an aircraft by registration or a specific flight number.</p>
        
        <form onSubmit={handleAddItem} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="itemValue" className="block text-sm font-medium text-gray-700 mb-1">
                {newItemType === 'REGISTRATION' ? 'Aircraft Registration' : 'Flight Number'}
              </label>
              <input
                id="itemValue"
                type="text"
                placeholder={newItemType === 'REGISTRATION' ? 'e.g., SP-LRD' : 'e.g., WZZ61699'}
                value={newItemValue}
                onChange={(e) => setNewItemValue(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                <button type="button" onClick={() => setNewItemType('REGISTRATION')} className={`w-1/2 py-1 text-sm rounded-md transition ${newItemType === 'REGISTRATION' ? 'bg-white shadow font-semibold text-gray-800' : 'text-gray-500'}`}>
                  Registration
                </button>
                <button type="button" onClick={() => setNewItemType('FLIGHT_NUMBER')} className={`w-1/2 py-1 text-sm rounded-md transition ${newItemType === 'FLIGHT_NUMBER' ? 'bg-white shadow font-semibold text-gray-800' : 'text-gray-500'}`}>
                  Flight No.
                </button>
              </div>
            </div>
          </div>
          <button type="submit" className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 transition flex items-center justify-center gap-2" disabled={loading}>
            {loading ? <FiLoader className="animate-spin" /> : 'Add Item'}
          </button>
        </form>
      </div>
      {diagnostics && (
        <div className="mt-6 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center">
          <p className="text-gray-500">
            Diagnostics: Last check at <span className="font-mono">{new Date(diagnostics.timestamp).toLocaleTimeString()}</span>,
            OpenSky reported <strong className="font-mono">{diagnostics.totalStatesReceived}</strong> flights.
          </p>
        </div>
      )}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Tracked Items</h2>
            <button onClick={() => getFlightStatuses(itemList)} disabled={loadingStatuses || loading} className="px-4 py-2 text-sm bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 disabled:opacity-50 transition">
              {loadingStatuses ? 'Refreshing...' : 'Refresh'}
            </button>
        </div>
        
        {itemList.length === 0 ? (
          <div className="text-center py-12 px-6 bg-white rounded-xl shadow-lg border border-gray-200">
            <FiInfo className="mx-auto text-4xl text-gray-400" />
            <h3 className="mt-2 text-lg font-semibold text-gray-800">No items tracked</h3>
            <p className="mt-1 text-sm text-gray-500">Use the form above to start tracking flights.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {itemList.map((item) => {
              const cleanedValue = item.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
              const status = statuses[cleanedValue];
              const hasDetails = status && status.icao24;

              const cardContent = (
                <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 transition hover:shadow-xl hover:border-blue-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono text-lg font-bold text-gray-900">{item.value}</p>
                      <p className="text-xs font-semibold uppercase text-gray-400">{item.type.replace('_', ' ')}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleNotify(item.id, item.notify_on_land)}
                        className={`p-2 rounded-full transition ${item.notify_on_land ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 hover:bg-gray-100'}`}
                        aria-label="Toggle notifications"
                      >
                        {item.notify_on_land ? <FiBell size={20} /> : <FiBellOff size={20} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDeleteItem(item.id)
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                        disabled={loading}
                        aria-label="Delete item"
                      >
                        <FiXCircle size={20}/>
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <StatusPill status={status} />
                  </div>
                </div>
              );

              return (
                <li key={item.id}>
                  {hasDetails ? (
                    <Link href={`/flight/${status.icao24}`}>
                      {cardContent}
                    </Link>
                  ) : (
                    <div>{cardContent}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
} 