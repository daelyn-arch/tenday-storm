import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCampaign } from '../store/campaign'
import { BeautifulMap } from '../map/BeautifulMap'
import { QuestsPanel } from './panels/QuestsPanel'
import { RumorsPanel } from './panels/RumorsPanel'
import { ItemsPanel } from './panels/ItemsPanel'
import { RegionsPanel } from './panels/RegionsPanel'
import { JournalPanel } from './panels/JournalPanel'
import { useCampaignChannel } from '../realtime/useCampaignChannel'
import { axialDistance } from '../hex/coords'

type Tab = 'quests' | 'rumors' | 'items' | 'regions' | 'journal'

const TABS: { id: Tab; label: string }[] = [
  { id: 'quests', label: 'Quests' },
  { id: 'rumors', label: 'Rumors' },
  { id: 'items', label: 'Items' },
  { id: 'regions', label: 'Regions' },
  { id: 'journal', label: 'Journal' },
]

export function PlayerView() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('journal')
  const { load, reset, campaign, loading, error } = useCampaign()

  useEffect(() => {
    if (id) load(id)
    return () => {
      reset()
    }
  }, [id, load, reset])

  useCampaignChannel(id ?? null)

  if (loading || !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-300">
        {error ? <span className="text-red-400">{error}</span> : 'Loading campaign…'}
      </div>
    )
  }
  const stormDist = axialDistance(
    { q: campaign.party_q, r: campaign.party_r },
    { q: campaign.storm_q, r: campaign.storm_r },
  )
  const stormEdgeDist = Math.max(0, stormDist - campaign.storm_radius)
  const inStorm = stormEdgeDist === 0
  const daysLeft = campaign.max_days - campaign.day + 1

  return (
    <div className="h-screen flex flex-col">
      <header className="iron-banner px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="font-display text-xl truncate">{campaign.name}</h1>
          <span className="text-ink-300 text-xs">
            Day {campaign.day}/{campaign.max_days}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span
            className={`px-2 py-0.5 rounded ${
              inStorm
                ? 'bg-red-900 text-red-100'
                : stormEdgeDist <= 1
                ? 'bg-red-900/70 text-red-100'
                : 'bg-storm-700/60 text-storm-200'
            }`}
            title="Distance to the storm's edge"
          >
            {inStorm
              ? 'In the storm!'
              : `Storm: ${stormEdgeDist} hex${stormEdgeDist === 1 ? '' : 'es'} from edge`}
          </span>
          <span className="text-ink-300">{daysLeft} day{daysLeft === 1 ? '' : 's'} left</span>
          <Link to="/" className="btn">
            Campaigns
          </Link>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[1fr_380px] min-h-0">
        <main className="relative min-h-0">
          <BeautifulMap
            seed={campaign.seed}
            width={200}
            height={150}
            tmxUrl={`${import.meta.env.BASE_URL}textures/_pita/Scenes.tmx`}
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
            {tab === 'quests' && <QuestsPanel readOnly />}
            {tab === 'rumors' && <RumorsPanel readOnly />}
            {tab === 'items' && <ItemsPanel readOnly />}
            {tab === 'regions' && <RegionsPanel readOnly />}
            {tab === 'journal' && <JournalPanel />}
          </div>
        </aside>
      </div>
    </div>
  )
}
