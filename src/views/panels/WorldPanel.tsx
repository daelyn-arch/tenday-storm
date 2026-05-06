import { useState } from 'react'
import { useCampaign } from '../../store/campaign'
import { axialDistance } from '../../hex/coords'

export function WorldPanel() {
  const { campaign, endDay, hexes, updateCampaign } = useCampaign()
  const [confirming, setConfirming] = useState(false)
  if (!campaign) return null
  const stormDist = axialDistance(
    { q: campaign.party_q, r: campaign.party_r },
    { q: campaign.storm_q, r: campaign.storm_r },
  )
  const stormEdgeDist = Math.max(0, stormDist - campaign.storm_radius)
  const next = campaign.storm_path[campaign.day] ?? null
  const inviteUrl = `${window.location.origin}/c/${campaign.id}/join?code=${campaign.invite_code}`
  const revealed = hexes.filter((h) => h.revealed).length
  return (
    <div className="p-4 space-y-4 text-sm overflow-y-auto h-full">
      <div className="panel p-3 space-y-2">
        <div className="font-display text-2xl">
          Day {campaign.day} <span className="text-ink-300 text-base">/ {campaign.max_days}</span>
        </div>
        <div className="text-ink-300 text-xs">
          {stormEdgeDist === 0
            ? 'Party is inside the storm'
            : `Storm edge ${stormEdgeDist} hex${stormEdgeDist === 1 ? '' : 'es'} from party`}
          {next ? ` · jumps next to (${next.q}, ${next.r})` : ' · final day'}
        </div>
        {confirming ? (
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={async () => { setConfirming(false); await endDay() }}>
              Confirm: end day
            </button>
            <button className="btn" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary w-full"
            disabled={campaign.day >= campaign.max_days}
            onClick={() => setConfirming(true)}
          >
            End day → advance storm
          </button>
        )}
      </div>

      <div className="panel p-3 space-y-2">
        <div className="font-display text-base">Invite players</div>
        <div className="text-xs text-ink-300">Share this link — players sign in via magic link, then are added as players.</div>
        <input className="input" readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} />
        <button
          className="btn"
          onClick={() => {
            navigator.clipboard.writeText(inviteUrl)
          }}
        >
          Copy link
        </button>
      </div>

      <div className="panel p-3 space-y-2 text-xs text-ink-300">
        <div className="font-display text-base text-ink-100">World stats</div>
        <div>{revealed} / {hexes.length} hexes revealed</div>
        <div>Seed: {campaign.seed}</div>
        <div>Final boss: ({campaign.final_boss_q}, {campaign.final_boss_r})</div>
      </div>

      <div className="panel p-3 space-y-3">
        <div className="font-display text-base">Storm tracker</div>
        <div className="text-xs text-ink-300">
          The storm jumps to a random hex each day. Flip this on once the party
          obtains a spell or item that lets them divine where it strikes next —
          they'll see the same dashed outline you do.
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={campaign.players_see_storm_next}
            onChange={(e) => updateCampaign({ players_see_storm_next: e.target.checked })}
          />
          <span>Reveal next storm location to players</span>
        </label>
        <div className="text-xs text-ink-300 border-t border-ink-700 pt-2">
          {next
            ? `Next jump: (${next.q}, ${next.r})`
            : 'No further jumps — this is the final day.'}
        </div>
        {next && (
          <button
            className="btn"
            onClick={() => {
              const land = hexes.filter(
                (h) =>
                  h.biome !== 'ocean' &&
                  !(h.q === campaign.party_q && h.r === campaign.party_r) &&
                  !(h.q === campaign.storm_q && h.r === campaign.storm_r),
              )
              if (!land.length) return
              const pick = land[Math.floor(Math.random() * land.length)]
              const path = campaign.storm_path.slice()
              path[campaign.day] = { q: pick.q, r: pick.r }
              updateCampaign({ storm_path: path })
            }}
          >
            Reroll next jump
          </button>
        )}
      </div>
    </div>
  )
}
