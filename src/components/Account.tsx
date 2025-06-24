'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Session } from '@supabase/supabase-js'
import AircraftTracker from './AircraftTracker'

export default function Account({ session }: { session: Session }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [fullname, setFullname] = useState<string | null>(null)
  const user = session.user

  useEffect(() => {
    let ignore = false
    async function getProfile() {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`full_name`)
        .eq('id', user.id)
        .single()

      if (!ignore) {
        if (error) {
          console.warn(error)
        } else if (data) {
          setFullname(data.full_name)
        }
      }

      setLoading(false)
    }

    getProfile()

    return () => {
      ignore = true
    }
  }, [session, user, supabase])

  return (
    <div className="form-widget">
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="text" value={user.email} disabled />
      </div>
      <div>
        <label htmlFor="fullName">Full Name</label>
        <input
          id="fullName"
          type="text"
          value={fullname || ''}
          disabled
        />
      </div>

      <div>
        <button className="button block" onClick={() => supabase.auth.signOut()}>
          Sign Out
        </button>
      </div>

      <hr className="my-8" />

      <AircraftTracker session={session} />
    </div>
  )
} 