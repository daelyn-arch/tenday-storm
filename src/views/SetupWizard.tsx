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
  const [width, setWidth] = useState(30)
  const [height, setHeight] = useState(40)
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

      // 4. Insert items
      const itemInserts = world.items.map((it) => ({
        ...it,
        campaign_id: campaignId,
      }))
      if (itemInserts.length) {
        const { error: iErr } = await supabase.from('items').insert(itemInserts)
        if (iErr) throw iErr
      }

      // 5. Insert rumors
      const rumorInserts = world.rumors.map((rm) => ({
        text: rm.text,
        is_true: rm.is_true,
        target_q: rm.target_q,
        target_r: rm.target_r,
        collected: rm.collected,
        source_region_id: rm.source_region_index != null ? regionIdByIndex[rm.source_region_index] : null,
        campaign_id: campaignId,
      }))
      if (rumorInserts.length) {
        const { error: rmErr } = await supabase.from('rumors').insert(rumorInserts)
        if (rmErr) throw rmErr
      }

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
                max={60}
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
                max={60}
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
                Real items: {world.items.filter((i) => i.is_real).length} · Fake:{' '}
                {world.items.filter((i) => !i.is_real).length}
              </div>
              <div>Rumors: {world.rumors.length}</div>
              <div>
                Storm starts at ({world.campaign.storm_q}, {world.campaign.storm_r}), {world.campaign.storm_path.length}-step path
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
              stormPath={world.campaign.storm_path}
              finalBoss={
                world.campaign.final_boss_q != null && world.campaign.final_boss_r != null
                  ? { q: world.campaign.final_boss_q, r: world.campaign.final_boss_r }
                  : null
              }
              items={world.items.map((it) => ({
                name: it.name,
                hex_q: it.hex_q,
                hex_r: it.hex_r,
                is_real: it.is_real,
                discovered: it.discovered,
              }))}
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
