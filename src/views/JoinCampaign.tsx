import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function JoinCampaign() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const code = params.get('code') ?? ''
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill display name from email.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email && !name) setName(data.user.email.split('@')[0])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-300 p-6">
        <div className="panel p-6 max-w-md text-sm">
          Missing invite code. Ask the DM to share the full <code>/join?code=…</code> link.
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        className="panel p-6 max-w-md w-full space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setSubmitting(true)
          setError(null)
          const { data, error } = await supabase.rpc('join_by_code', { code, name })
          if (error || !data) {
            setError(error?.message ?? 'Could not join.')
            setSubmitting(false)
            return
          }
          navigate(`/c/${data}/play`)
        }}
      >
        <h1 className="font-display text-2xl">Join campaign</h1>
        <p className="text-ink-300 text-sm">
          You've been invited with code <span className="text-storm-400">{code}</span>
          {id && id !== 'new' && id !== 'undefined' ? <> for campaign <span className="text-storm-400">{id}</span></> : null}.
        </p>
        <label className="block">
          <span className="label-tiny">Display name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should the party call you?"
          />
        </label>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button className="btn btn-primary w-full" disabled={submitting} type="submit">
          {submitting ? 'Joining…' : 'Join as player'}
        </button>
      </form>
    </div>
  )
}
