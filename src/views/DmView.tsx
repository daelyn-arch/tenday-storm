import { useEffect, useMemo, useState, type ReactElement } from 'react'
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
import { axialDistance } from '../hex/coords'
import { Display, Eyebrow, DayRing, StatusPill, Icons } from '../ui/forged'

type Tab = 'inspector' | 'quests' | 'rumors' | 'items' | 'encounters' | 'regions' | 'world' | 'journal'

type TabIcon = (p: { size?: number }) => ReactElement

const TABS: { id: Tab; label: string; Icon: TabIcon }[] = [
  { id: 'inspector', label: 'Hex', Icon: Icons.Hex },
  { id: 'quests', label: 'Quests', Icon: Icons.Scroll },
  { id: 'rumors', label: 'Rumors', Icon: Icons.Eye },
  { id: 'encounters', label: 'Encounters', Icon: Icons.Sword },
  { id: 'items', label: 'Items', Icon: Icons.Bag },
  { id: 'regions', label: 'Regions', Icon: Icons.Map },
  { id: 'journal', label: 'Journal', Icon: Icons.Book },
  { id: 'world', label: 'World', Icon: Icons.Globe },
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
        {error ? <span className="text-blood-400">{error}</span> : 'Loading campaign…'}
      </div>
    )
  }

  if (myRole !== 'dm') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-ink-200">
        <div>You&rsquo;re a player on this campaign.</div>
        <Link to={`/c/${campaign.id}/play`} className="btn btn-primary">
          Open player view
        </Link>
      </div>
    )
  }

  // Storm proximity for the header pill
  const stormDist = axialDistance(
    { q: campaign.party_q, r: campaign.party_r },
    { q: campaign.storm_q, r: campaign.storm_r },
  )
  const stormEdgeDist = Math.max(0, stormDist - campaign.storm_radius)
  const inStorm = stormEdgeDist === 0
  const stormTone: 'safe' | 'caution' | 'danger' | 'storm' =
    inStorm ? 'danger' : stormEdgeDist <= 1 ? 'caution' : stormEdgeDist <= 3 ? 'storm' : 'safe'
  const stormIcon = inStorm ? <Icons.Flame size={11} /> : <Icons.Wind size={11} />
  const stormLabel = inStorm
    ? 'In the storm'
    : `Storm ${stormEdgeDist} hex${stormEdgeDist === 1 ? '' : 'es'}`

  return (
    <div className="h-screen flex flex-col">
      <header className="iron-banner px-5 py-2.5 flex items-center gap-4 min-h-[64px]">
        <Icons.Storm size={22} />
        <div className="min-w-0">
          <Display as="h1" className="text-xl truncate leading-tight">{campaign.name}</Display>
          <Eyebrow>Dungeon Master · seed {campaign.seed}</Eyebrow>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <DayRing day={campaign.day} max={campaign.max_days} size={44} />
          <StatusPill tone={stormTone} icon={stormIcon}>{stormLabel}</StatusPill>
          <Link to="/" className="btn btn-ghost btn-sm">
            Campaigns
          </Link>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(`/c/${campaign.id}/play`)}
          >
            <Icons.Eye size={12} /> Player preview
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
          <nav className="flex border-b border-ink-700" role="tablist" aria-label="Campaign panels">
            {TABS.map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  aria-label={t.label}
                  title={t.label}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-display uppercase tracking-wider border-r border-ink-700 whitespace-nowrap min-h-[40px] transition-colors ${
                    active
                      ? 'flex-1 bg-storm-700/60 text-ink-50 border-t-2 border-t-gold-500 -mt-px'
                      : 'text-ink-300 hover:text-ink-100'
                  }`}
                >
                  <t.Icon size={15} />
                  {active && <span>{t.label}</span>}
                </button>
              )
            })}
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
