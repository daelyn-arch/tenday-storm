import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCampaign } from '../store/campaign'
import { HexMap, type Pin } from '../hex/HexMap'
import { HexInspector } from './panels/HexInspector'
import { QuestsPanel } from './panels/QuestsPanel'
import { RumorsPanel } from './panels/RumorsPanel'
import { ItemsPanel } from './panels/ItemsPanel'
import { EncountersPanel } from './panels/EncountersPanel'
import { RegionsPanel } from './panels/RegionsPanel'
import { WorldPanel } from './panels/WorldPanel'
import { JournalPanel } from './panels/JournalPanel'
import { useCampaignChannel } from '../realtime/useCampaignChannel'

type Tab = 'inspector' | 'quests' | 'rumors' | 'items' | 'encounters' | 'regions' | 'world' | 'journal'

const TABS: { id: Tab; label: string }[] = [
  { id: 'inspector', label: 'Hex' },
  { id: 'quests', label: 'Quests' },
  { id: 'rumors', label: 'Rumors' },
  { id: 'encounters', label: 'Encounters' },
  { id: 'items', label: 'Items' },
  { id: 'regions', label: 'Regions' },
  { id: 'journal', label: 'Journal' },
  { id: 'world', label: 'World' },
]

export function DmView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('inspector')
  const {
    load,
    reset,
    campaign,
    hexes,
    regions,
    quests,
    rumors,
    encounters,
    journal,
    selected,
    setSelected,
    loading,
    error,
    myRole,
  } = useCampaign()

  useEffect(() => {
    if (id) load(id)
    return () => {
      reset()
    }
  }, [id, load, reset])

  useCampaignChannel(id ?? null)

  const pins: Pin[] = useMemo(() => {
    const out: Pin[] = []
    for (const q of quests) {
      if (q.target_q != null && q.target_r != null) out.push({ q: q.target_q, r: q.target_r, kind: 'quest' })
    }
    for (const r of rumors) {
      if (r.target_q != null && r.target_r != null) out.push({ q: r.target_q, r: r.target_r, kind: 'rumor' })
    }
    for (const e of encounters) {
      if (e.target_q != null && e.target_r != null) out.push({ q: e.target_q, r: e.target_r, kind: 'encounter' })
    }
    for (const j of journal) {
      if (j.target_q != null && j.target_r != null) out.push({ q: j.target_q, r: j.target_r, kind: 'journal' })
    }
    return out
  }, [quests, rumors, encounters, journal])

  if (loading || !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-300">
        {error ? <span className="text-red-400">{error}</span> : 'Loading campaign…'}
      </div>
    )
  }

  if (myRole !== 'dm') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-ink-200">
        <div>You're a player on this campaign.</div>
        <Link to={`/c/${campaign.id}/play`} className="btn btn-primary">
          Open player view
        </Link>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="iron-banner px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="font-display text-xl truncate">{campaign.name}</h1>
          <span className="text-ink-300 text-xs">
            DM · Day {campaign.day}/{campaign.max_days}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className="btn">
            Campaigns
          </Link>
          <button className="btn" onClick={() => navigate(`/c/${campaign.id}/play`)}>
            Player preview
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[1fr_380px] min-h-0">
        <main className="relative min-h-0">
          <HexMap
            width={campaign.width}
            height={campaign.height}
            hexes={hexes}
            regions={regions}
            partyHex={{ q: campaign.party_q, r: campaign.party_r }}
            stormHex={{ q: campaign.storm_q, r: campaign.storm_r }}
            stormRadius={campaign.storm_radius}
            nextStormHex={campaign.storm_path[campaign.day] ?? null}
            finalBoss={
              campaign.final_boss_q != null && campaign.final_boss_r != null
                ? { q: campaign.final_boss_q, r: campaign.final_boss_r }
                : null
            }
            pins={pins}
            selected={selected}
            onSelect={(next) => {
              setSelected(next)
              if (next) setTab('inspector')
            }}
            mode="dm"
          />
        </main>
        <aside className="border-l border-ink-700 flex flex-col min-h-0">
          <nav className="flex border-b border-ink-700 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-sm border-r border-ink-700 whitespace-nowrap ${
                  tab === t.id ? 'bg-storm-700/50 text-ink-50' : 'text-ink-300 hover:text-ink-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex-1 min-h-0">
            {tab === 'inspector' && <HexInspector />}
            {tab === 'quests' && <QuestsPanel />}
            {tab === 'rumors' && <RumorsPanel />}
            {tab === 'encounters' && <EncountersPanel />}
            {tab === 'items' && <ItemsPanel />}
            {tab === 'regions' && <RegionsPanel />}
            {tab === 'journal' && <JournalPanel />}
            {tab === 'world' && <WorldPanel />}
          </div>
        </aside>
      </div>
    </div>
  )
}
