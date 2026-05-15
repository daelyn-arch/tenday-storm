import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { CampaignRow, MemberRow } from '../types/db'
import { Display, Eyebrow, DayRing, StatusPill, Icons, PanelIron } from '../ui/forged'

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
    <div className="min-h-screen flex flex-col">
      {/* Iron banner header */}
      <header className="iron-banner px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Icons.Storm size={24} />
          <Display as="h1" className="text-xl">Tenday Storm</Display>
        </div>
        {email && <span className="text-sm text-ink-300 truncate max-w-[40ch]">{email}</span>}
        <button className="btn btn-ghost btn-sm" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>

      <main className="flex-1 px-6 py-10 max-w-4xl w-full mx-auto">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <Eyebrow>The Reckoning</Eyebrow>
            <Display as="h2" className="text-3xl mt-1">Your Campaigns</Display>
          </div>
          <Link to="/c/new" className="btn btn-primary btn-lg">
            <Icons.Plus size={14} /> New campaign
          </Link>
        </div>

        {loading ? (
          <div className="text-ink-300 italic py-12 text-center">Loading…</div>
        ) : campaigns.length === 0 ? (
          <PanelIron className="p-10 text-center space-y-3">
            <Eyebrow>No campaigns yet</Eyebrow>
            <Display as="h3" className="text-2xl">A storm hasn&rsquo;t been written for you.</Display>
            <p className="text-ink-200 max-w-md mx-auto">
              Start one as DM, or have a DM share an invite link.
            </p>
            <Link to="/c/new" className="btn btn-primary btn-lg inline-flex mt-4">
              <Icons.Plus size={14} /> Forge the first one
            </Link>
          </PanelIron>
        ) : (
          <ul className="flex flex-col gap-4">
            {campaigns.map((c) => {
              const late = c.day / c.max_days > 0.7 && c.day < c.max_days
              const ended = c.day >= c.max_days
              return (
                <li key={c.id}>
                  <PanelIron className="p-5 md:p-6">
                    <div className="grid grid-cols-[auto_1fr_auto] gap-5 items-center">
                      <DayRing day={c.day} max={c.max_days} size={72} />
                      <div className="min-w-0">
                        <Display as="div" className="text-xl truncate">{c.name}</Display>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-sm text-ink-300">
                          <span className="inline-flex items-center gap-1.5">
                            <Icons.Hex size={13} />
                            {c.width}×{c.height} hexes
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            {c.role === 'dm' ? <Icons.Crown size={13} /> : <Icons.Sword size={13} />}
                            {c.role === 'dm' ? 'Dungeon Master' : 'Player'}
                          </span>
                          {ended && (
                            <StatusPill tone="neutral" icon={<Icons.Check size={11} />}>
                              Concluded
                            </StatusPill>
                          )}
                          {late && (
                            <StatusPill tone="danger" icon={<Icons.Flame size={11} />}>
                              Final days
                            </StatusPill>
                          )}
                        </div>
                      </div>
                      <Link
                        to={`/c/${c.id}/${c.role === 'dm' ? 'dm' : 'play'}`}
                        className="btn btn-primary"
                      >
                        Open
                      </Link>
                    </div>
                  </PanelIron>
                </li>
              )
            })}
          </ul>
        )}

        <p className="mt-8 text-center text-xs italic text-ink-300">
          Each campaign is a sealed book — keep its pages with one DM and as many players as your table can hold.
        </p>
      </main>
    </div>
  )
}
