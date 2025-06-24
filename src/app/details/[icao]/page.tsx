'use client';

import React from 'react';
import FlightDetailsClient from "./FlightDetailsClient";

// This is now a very simple Server Component.
// Its only job is to get the `icao` from the URL and pass it to the Client Component.
interface PageProps {
  params: Promise<{ icao: string }>;
}

export default async function FlightDetailsPage({ params }: PageProps) {
  const { icao } = await params;
  
  console.log('Page component: ICAO from params:', icao);
  
  return <FlightDetailsClient icao={icao} />;
}