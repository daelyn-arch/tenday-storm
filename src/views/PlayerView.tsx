import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCampaign } from '../store/campaign'
import { HexMap } from '../hex/HexMap'
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
  const {
    load,
    reset,
    campaign,
    hexes,
    regions,
    items,
    selected,
    setSelected,
    loading,
    error,
  } = useCampaign()

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
  const daysLeft = campaign.max_days - campaign.day + 1

  return (
    <div className="h-screen flex flex-col">
      <header className="px-4 py-2 border-b border-ink-700 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="font-display text-xl truncate">{campaign.name}</h1>
          <span className="text-ink-300 text-xs">
            Day {campaign.day}/{campaign.max_days}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span
            className={`px-2 py-0.5 rounded ${stormDist <= 2 ? 'bg-red-900 text-red-100' : 'bg-storm-700/60 text-storm-200'}`}
            title="Storm distance from party"
          >
            Storm: {stormDist} hex{stormDist === 1 ? '' : 'es'} away
          </span>
          <span className="text-ink-300">{daysLeft} day{daysLeft === 1 ? '' : 's'} left</span>
          <Link to="/" className="btn">
            Campaigns
          </Link>
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
            finalBoss={null}
            items={items.map((it) => ({
              name: it.name,
              hex_q: it.hex_q,
              hex_r: it.hex_r,
              is_real: it.is_real,
              discovered: it.discovered,
            }))}
            selected={selected}
            onSelect={(q, r) => setSelected({ q, r })}
            mode="player"
          />
          {selected && (() => {
            const h = hexes.find((x) => x.q === selected.q && x.r === selected.r)
            if (!h) return null
            const isRevealed = h.revealed
            const region = regions.find((r) => r.id === h.region_id)
            const features = isRevealed ? ((h.generated?.features ?? []) as string[]) : []
            return (
              <div className="absolute bottom-4 left-4 panel p-3 max-w-sm text-sm">
                <div className="font-display text-base">
                  {isRevealed ? `${h.biome[0].toUpperCase()}${h.biome.slice(1)} (${h.q}, ${h.r})` : `Unknown (${h.q}, ${h.r})`}
                </div>
                {region && <div className="text-xs text-ink-300">{region.name}</div>}
                {features.length > 0 && (
                  <ul className="list-disc pl-5 mt-1 text-xs">
                    {features.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                )}
                {!isRevealed && (
                  <div className="text-xs text-ink-300 italic mt-1">
                    {axialDistance({ q: h.q, r: h.r }, { q: campaign.party_q, r: campaign.party_r }) <= 1
                      ? 'Adjacent to the party — biome glimpsed at distance.'
                      : 'Beyond known lands.'}
                  </div>
                )}
              </div>
            )
          })()}
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
