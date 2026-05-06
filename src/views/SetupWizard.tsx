import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateWorld, type GeneratedWorld } from '../world/generate'
import { HexMap } from '../hex/HexMap'
import { supabase } from '../lib/supabase'
import type { HexRow, RegionRow } from '../types/db'

function randomSeed() {
  return Math.floor(Math.random() * 0xfffffff)
}

export function SetupWizard() {
  const navigate = useNavigate()
  const [name, setName] = useState('The Tenday Storm')
  const [seed, setSeed] = useState(() => randomSeed())
  const [width, setWidth] = useState(20)
  const [height, setHeight] = useState(20)
  const [maxDays, setMaxDays] = useState(10)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const world = useMemo<GeneratedWorld | null>(() => {
    if (width < 10 || height < 10) return null
    try {
      return generateWorld({ name, seed, width, height, maxDays })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
      return null
    }
  }, [name, seed, width, height, maxDays])

  // Stub region rows so HexMap can color outlines in preview.
  const previewRegions: RegionRow[] = useMemo(() => {
    if (!world) return []
    return world.regions.map((r, i) => ({ ...r, id: `preview-${i}`, campaign_id: 'preview' }))
  }, [world])

  const previewHexes = useMemo(() => {
    if (!world) return []
    return world.hexes.map((h) => ({
      ...h,
      region_id: (() => {
        const idx = world.hexRegionIndex.get(`${h.q},${h.r}`)
        return idx != null ? `preview-${idx}` : null
      })(),
    }))
  }, [world])

  async function createCampaign() {
    if (!world) return
    setSubmitting(true)
    setError(null)
    try {
      // Generate UUIDs client-side so we never need RETURNING. RETURNING on the
      // campaigns insert would evaluate the SELECT policy `is_member(id)` BEFORE
      // the AFTER-trigger has added the creator as a DM, which fails RLS.
      const campaignId = crypto.randomUUID()

      // 1. Insert campaign (no .select())
      const { error: cErr } = await supabase
        .from('campaigns')
        .insert({ id: campaignId, ...world.campaign })
      if (cErr) throw cErr

      // 2. Insert regions with pre-generated ids
      const regionIdByIndex: string[] = world.regions.map(() => crypto.randomUUID())
      const regionInserts = world.regions.map((r, i) => ({
        ...r,
        id: regionIdByIndex[i],
        campaign_id: campaignId,
      }))
      const { error: rErr } = await supabase.from('regions').insert(regionInserts)
      if (rErr) throw rErr

      // 3. Insert hexes (with region_id resolved from index map)
      const hexInserts: HexRow[] = world.hexes.map((h) => {
        const idx = world.hexRegionIndex.get(`${h.q},${h.r}`)
        const region_id = idx != null ? regionIdByIndex[idx] : null
        return { ...h, campaign_id: campaignId, region_id }
      })
      // Chunk to avoid request size limits.
      for (let i = 0; i < hexInserts.length; i += 500) {
        const chunk = hexInserts.slice(i, i + 500)
        const { error: hErr } = await supabase.from('hexes').insert(chunk)
        if (hErr) throw hErr
      }

      // Items + rumors are intentionally not generated — the DM creates them
      // by hand from the Items and Rumors panels once play begins.

      navigate(`/c/${campaignId}/dm`)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
      setError((e as Error).message ?? 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b border-ink-700 flex items-center justify-between">
        <h1 className="font-display text-2xl">New Campaign</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={() => navigate('/')} disabled={submitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={createCampaign} disabled={!world || submitting}>
            {submitting ? 'Creating…' : 'Create campaign'}
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[320px_1fr] gap-0 min-h-0">
        <aside className="p-4 border-r border-ink-700 space-y-3 overflow-y-auto">
          <label className="block">
            <span className="label-tiny">Campaign name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="label-tiny">World seed</span>
            <div className="flex gap-2">
              <input
                className="input"
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value || '0', 10) || 0)}
              />
              <button className="btn shrink-0" type="button" onClick={() => setSeed(randomSeed())}>
                ⟳
              </button>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label-tiny">Width</span>
              <input
                className="input"
                type="number"
                min={10}
                max={30}
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value || '0', 10) || 0)}
              />
            </label>
            <label className="block">
              <span className="label-tiny">Height</span>
              <input
                className="input"
                type="number"
                min={10}
                max={30}
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value || '0', 10) || 0)}
              />
            </label>
          </div>
          <label className="block">
            <span className="label-tiny">Days until cataclysm</span>
            <input
              className="input"
              type="number"
              min={3}
              max={30}
              value={maxDays}
              onChange={(e) => setMaxDays(parseInt(e.target.value || '0', 10) || 10)}
            />
          </label>
          {world && (
            <div className="text-xs text-ink-300 space-y-1 pt-2 border-t border-ink-700">
              <div>Regions: {world.regions.length}</div>
              <div>
                Storm starts at ({world.campaign.storm_q}, {world.campaign.storm_r}), radius {world.campaign.storm_radius}, jumps to {world.campaign.storm_path.length} random hexes over the campaign
              </div>
              <div>
                Party at ({world.campaign.party_q}, {world.campaign.party_r})
              </div>
            </div>
          )}
          {error && <div className="text-sm text-red-400">{error}</div>}
        </aside>
        <main className="relative">
          {world ? (
            <HexMap
              width={width}
              height={height}
              hexes={previewHexes}
              regions={previewRegions}
              partyHex={{ q: world.campaign.party_q, r: world.campaign.party_r }}
              stormHex={{ q: world.campaign.storm_q, r: world.campaign.storm_r }}
              stormRadius={world.campaign.storm_radius}
              nextStormHex={world.campaign.storm_path[1] ?? null}
              finalBoss={
                world.campaign.final_boss_q != null && world.campaign.final_boss_r != null
                  ? { q: world.campaign.final_boss_q, r: world.campaign.final_boss_r }
                  : null
              }
              mode="dm"
            />
          ) : (
            <div className="p-8 text-ink-300">Adjust settings to generate a preview.</div>
          )}
        </main>
      </div>
    </div>
  )
}
