import { useState } from 'react'
import { useCampaign } from '../../store/campaign'
import { BIOME_LABEL } from '../../world/biomes'
import { axialDistance } from '../../hex/coords'
import { LOCATION_TYPES, type LocationType } from '../../types/db'

export function HexInspector() {
  const { selected, hexes, campaign, regions, updateHex, moveParty } = useCampaign()
  const [draftFeature, setDraftFeature] = useState('')
  if (!selected) {
    return <div className="p-4 text-ink-300 text-sm">Click a hex to inspect.</div>
  }
  const hex = hexes.find((h) => h.q === selected.q && h.r === selected.r)
  if (!hex) {
    return <div className="p-4 text-ink-300 text-sm">Hex not found.</div>
  }
  const region = regions.find((r) => r.id === hex.region_id)
  const partyDist = campaign ? axialDistance({ q: hex.q, r: hex.r }, { q: campaign.party_q, r: campaign.party_r }) : 0
  const stormCenterDist = campaign ? axialDistance({ q: hex.q, r: hex.r }, { q: campaign.storm_q, r: campaign.storm_r }) : 0
  const stormLabel = campaign
    ? stormCenterDist <= campaign.storm_radius
      ? 'in storm'
      : `storm ${stormCenterDist - campaign.storm_radius}`
    : 'storm —'
  const features = (hex.generated?.features ?? []) as string[]

  function setFeatures(next: string[]) {
    if (!hex) return
    updateHex(hex.q, hex.r, { generated: { ...(hex.generated ?? {}), features: next } })
  }

  return (
    <div className="p-4 space-y-3 text-sm overflow-y-auto h-full">
      <div>
        <div className="font-display text-lg">
          {BIOME_LABEL[hex.biome]} ({hex.q}, {hex.r})
        </div>
        <div className="text-ink-300 text-xs">
          {region?.name ?? 'no region'} · party {partyDist} · {stormLabel}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn"
          onClick={() => updateHex(hex.q, hex.r, { revealed: !hex.revealed })}
        >
          {hex.revealed ? 'Hide from players' : 'Reveal to players'}
        </button>
        <button className="btn btn-primary" onClick={() => moveParty({ q: hex.q, r: hex.r })}>
          Move party here
        </button>
      </div>
      <div>
        <div className="label-tiny">Location</div>
        <select
          className="input"
          value={hex.location_type ?? ''}
          onChange={(e) =>
            updateHex(hex.q, hex.r, {
              location_type: (e.target.value || null) as LocationType | null,
            })
          }
        >
          <option value="">— wilderness —</option>
          {LOCATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className="label-tiny">Features</div>
        {features.length > 0 ? (
          <ul className="space-y-1">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  value={f}
                  onChange={(e) => {
                    const next = features.slice()
                    next[i] = e.target.value
                    setFeatures(next)
                  }}
                />
                <button
                  className="btn btn-danger text-xs py-1 px-2 shrink-0"
                  onClick={() => setFeatures(features.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-ink-300 text-xs italic">No features.</div>
        )}
        <form
          className="flex gap-2 mt-2"
          onSubmit={(e) => {
            e.preventDefault()
            const v = draftFeature.trim()
            if (!v) return
            setFeatures([...features, v])
            setDraftFeature('')
          }}
        >
          <input
            className="input"
            placeholder="Add a feature…"
            value={draftFeature}
            onChange={(e) => setDraftFeature(e.target.value)}
          />
          <button className="btn shrink-0" type="submit">
            Add
          </button>
        </form>
      </div>
      <div>
        <div className="label-tiny">DM notes (private)</div>
        <textarea
          className="input min-h-[8rem] resize-y"
          value={hex.dm_notes}
          onChange={(e) => updateHex(hex.q, hex.r, { dm_notes: e.target.value })}
          placeholder="Encounter outcome, NPCs, hooks…"
        />
      </div>
    </div>
  )
}
