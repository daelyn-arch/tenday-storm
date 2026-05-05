import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'

type Mode = 'signin' | 'signup'

export function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="panel p-6 max-w-lg space-y-3">
          <h1 className="font-display text-2xl">Supabase not configured</h1>
          <p className="text-ink-200 text-sm">
            Copy <code className="text-storm-400">.env.example</code> to <code className="text-storm-400">.env</code> and set
            <code className="text-storm-400"> VITE_SUPABASE_URL</code> and{' '}
            <code className="text-storm-400">VITE_SUPABASE_ANON_KEY</code> from your Supabase project, then restart{' '}
            <code className="text-storm-400">npm run dev</code>. Setup steps are in the project README.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-ink-300">Loading…</div>
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <form
          className="panel p-6 max-w-md w-full space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            setInfo(null)
            setSubmitting(true)
            try {
              if (mode === 'signup') {
                const { data, error } = await supabase.auth.signUp({ email, password })
                if (error) {
                  setError(error.message)
                } else if (!data.session) {
                  // Email confirmation is on. Tell the user.
                  setInfo(
                    'Account created — check your email to confirm, OR disable "Confirm email" in Supabase → Authentication → Providers → Email and sign in.',
                  )
                }
                // If session is set, onAuthStateChange will route us through.
              } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) setError(error.message)
              }
            } finally {
              setSubmitting(false)
            }
          }}
        >
          <h1 className="font-display text-3xl">Tenday Storm</h1>

          <div className="flex gap-2 text-sm">
            <button
              type="button"
              className={`flex-1 py-1.5 rounded border ${
                mode === 'signin' ? 'bg-storm-700/60 border-storm-400/40 text-ink-50' : 'border-ink-400/30 text-ink-300'
              }`}
              onClick={() => {
                setMode('signin')
                setError(null)
                setInfo(null)
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 rounded border ${
                mode === 'signup' ? 'bg-storm-700/60 border-storm-400/40 text-ink-50' : 'border-ink-400/30 text-ink-300'
              }`}
              onClick={() => {
                setMode('signup')
                setError(null)
                setInfo(null)
              }}
            >
              Sign up
            </button>
          </div>

          <label className="block">
            <span className="label-tiny">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="label-tiny">Password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </label>

          {error && <div className="text-red-400 text-sm">{error}</div>}
          {info && <div className="text-storm-400 text-sm">{info}</div>}

          <button className="btn btn-primary w-full" type="submit" disabled={submitting}>
            {submitting ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </div>
    )
  }

  return <Outlet />
}
