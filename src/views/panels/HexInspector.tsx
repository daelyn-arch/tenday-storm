import { useCampaign } from '../../store/campaign'
import { BIOME_LABEL } from '../../world/biomes'
import { axialDistance } from '../../hex/coords'

export function HexInspector() {
  const { selected, hexes, campaign, regions, updateHex, moveParty } = useCampaign()
  if (!selected) {
    return <div className="p-4 text-ink-300 text-sm">Click a hex to inspect.</div>
  }
  const hex = hexes.find((h) => h.q === selected.q && h.r === selected.r)
  if (!hex) {
    return <div className="p-4 text-ink-300 text-sm">Hex not found.</div>
  }
  const region = regions.find((r) => r.id === hex.region_id)
  const partyDist = campaign ? axialDistance({ q: hex.q, r: hex.r }, { q: campaign.party_q, r: campaign.party_r }) : 0
  const stormDist = campaign ? axialDistance({ q: hex.q, r: hex.r }, { q: campaign.storm_q, r: campaign.storm_r }) : 0
  const features = (hex.generated?.features ?? []) as string[]
  const encounters = (hex.generated?.encounters ?? []) as { weight: number; text: string }[]
  return (
    <div className="p-4 space-y-3 text-sm overflow-y-auto h-full">
      <div>
        <div className="font-display text-lg">
          {BIOME_LABEL[hex.biome]} ({hex.q}, {hex.r})
        </div>
        <div className="text-ink-300 text-xs">
          {region?.name ?? 'no region'} · party {partyDist} · storm {stormDist}
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
      {features.length > 0 && (
        <div>
          <div className="label-tiny">Features</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {features.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {encounters.length > 0 && (
        <div>
          <div className="label-tiny">Encounter pool</div>
          <ul className="list-disc pl-5 space-y-0.5 text-ink-200">
            {encounters.map((e, i) => (
              <li key={i}>{e.text}</li>
            ))}
          </ul>
        </div>
      )}
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
