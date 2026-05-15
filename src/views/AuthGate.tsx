import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { Display, Eyebrow, StatusPill, Icons } from '../ui/forged'

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
        <div className="panel p-8 max-w-lg space-y-3">
          <Eyebrow>Setup required</Eyebrow>
          <Display as="h1" className="text-3xl">Supabase not configured</Display>
          <p className="text-ink-200">
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
          className="panel p-8 max-w-md w-full space-y-5"
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
                  setInfo(
                    'Account created — check your email to confirm, OR disable "Confirm email" in Supabase → Authentication → Providers → Email and sign in.',
                  )
                }
              } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) setError(error.message)
              }
            } finally {
              setSubmitting(false)
            }
          }}
        >
          {/* Crest */}
          <div className="flex flex-col items-center gap-3 pb-2">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-ink-900"
              style={{
                background: 'radial-gradient(circle at 35% 30%, #f4cb6a, #a67c2f 60%, #6a4a14)',
                border: '2px solid #6b4818',
                boxShadow: 'inset 0 2px 6px rgba(255,235,180,.45), 0 4px 10px rgba(0,0,0,.45)',
              }}
              aria-hidden="true"
            >
              <Icons.Storm size={28} />
            </div>
            <Eyebrow>Campaign Companion</Eyebrow>
            <Display as="h1" className="text-3xl text-center">Tenday Storm</Display>
          </div>

          {/* Sign-in / sign-up tabs */}
          <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              className={`btn ${mode === 'signin' ? 'btn-gold' : 'btn-ghost'}`}
              onClick={() => { setMode('signin'); setError(null); setInfo(null) }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={`btn ${mode === 'signup' ? 'btn-gold' : 'btn-ghost'}`}
              onClick={() => { setMode('signup'); setError(null); setInfo(null) }}
            >
              Sign up
            </button>
          </div>

          <div className="divider-gold" />

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

          {error && (
            <StatusPill tone="danger" icon={<Icons.X size={11} />}>
              {error}
            </StatusPill>
          )}
          {info && (
            <StatusPill tone="storm" icon={<Icons.Check size={11} />}>
              {info}
            </StatusPill>
          )}

          <button className="btn btn-primary btn-lg w-full" type="submit" disabled={submitting}>
            {submitting ? 'Working…' : mode === 'signup' ? 'Create account' : 'Begin the Tenday'}
          </button>

          <p className="text-center text-xs text-ink-300 italic">
            One DM, one realm. Players join by invite link.
          </p>
        </form>
      </div>
    )
  }

  return <Outlet />
}
