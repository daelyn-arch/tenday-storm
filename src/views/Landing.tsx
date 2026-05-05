import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { CampaignRow, MemberRow } from '../types/db'

type CampaignWithRole = CampaignRow & { role: MemberRow['role'] }

export function Landing() {
  const [campaigns, setCampaigns] = useState<CampaignWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      if (mounted) setEmail(u.user?.email ?? null)
      const { data: members } = await supabase
        .from('campaign_members')
        .select('campaign_id, role, campaigns(*)')
        .returns<{ campaign_id: string; role: MemberRow['role']; campaigns: CampaignRow }[]>()
      if (mounted) {
        setCampaigns((members ?? []).map((m) => ({ ...m.campaigns, role: m.role })))
        setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="font-display text-4xl">Tenday Storm</h1>
        <div className="flex items-center gap-3 text-sm text-ink-300">
          {email && <span>{email}</span>}
          <button className="btn" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <section className="panel p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">Your campaigns</h2>
          <Link to="/c/new" className="btn btn-primary">
            New campaign
          </Link>
        </div>
        {loading ? (
          <div className="text-ink-300">Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className="text-ink-300 text-sm">
            No campaigns yet. Start one as DM, or have a DM share an invite link.
          </div>
        ) : (
          <ul className="space-y-2">
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between bg-ink-900/40 rounded p-3">
                <div>
                  <div className="font-display text-lg">{c.name}</div>
                  <div className="text-xs text-ink-300">
                    Day {c.day}/{c.max_days} · {c.width}×{c.height} hexes · {c.role}
                  </div>
                </div>
                <Link to={`/c/${c.id}/${c.role === 'dm' ? 'dm' : 'play'}`} className="btn btn-primary">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
