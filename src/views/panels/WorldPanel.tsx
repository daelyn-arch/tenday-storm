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
  const inviteUrl = `${window.location.origin}/c/${campaign.id}/join?code=${campaign.invite_code}`
  const revealed = hexes.filter((h) => h.revealed).length
  return (
    <div className="p-4 space-y-4 text-sm overflow-y-auto h-full">
      <div className="panel p-3 space-y-2">
        <div className="font-display text-2xl">
          Day {campaign.day} <span className="text-ink-300 text-base">/ {campaign.max_days}</span>
        </div>
        <div className="text-ink-300 text-xs">
          Storm {stormDist} hexes from party · Path step {Math.min(campaign.day, campaign.storm_path.length)} /{' '}
          {campaign.storm_path.length}
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

      <div className="panel p-3 space-y-2">
        <div className="font-display text-base">Storm</div>
        <div className="text-xs text-ink-300">
          Step the storm to a custom hex (overrides the default path step on the next end-day).
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="label-tiny">Storm Q</span>
            <input
              className="input"
              type="number"
              value={campaign.storm_q}
              onChange={(e) => updateCampaign({ storm_q: parseInt(e.target.value || '0', 10) })}
            />
          </label>
          <label className="block">
            <span className="label-tiny">Storm R</span>
            <input
              className="input"
              type="number"
              value={campaign.storm_r}
              onChange={(e) => updateCampaign({ storm_r: parseInt(e.target.value || '0', 10) })}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
