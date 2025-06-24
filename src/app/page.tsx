'use client';

import dynamic from 'next/dynamic'

const ClientMap = dynamic(() => import('../components/ClientMap'), { 
  ssr: false,
  loading: () => <div className="h-screen w-full bg-gray-200 flex items-center justify-center"><p>Loading Map...</p></div>
})

export default function Home() {
  return (
    <main>
      <ClientMap />
    </main>
  )
}
