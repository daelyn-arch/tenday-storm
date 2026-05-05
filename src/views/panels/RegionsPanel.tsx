import { useCampaign } from '../../store/campaign'

export function RegionsPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { regions, hexes, updateRegion } = useCampaign()
  // For read-only (player) mode, only show regions with at least one revealed hex.
  const visible = readOnly
    ? regions.filter((r) => hexes.some((h) => h.region_id === r.id && h.revealed))
    : regions
  return (
    <div className="p-4 space-y-3 text-sm overflow-y-auto h-full">
      <ul className="space-y-3">
        {visible.map((r) => (
          <li key={r.id} className="panel p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: r.color }} />
                <input
                  className="input bg-transparent border-transparent font-display text-base px-0"
                  value={r.name}
                  disabled={readOnly}
                  onChange={(e) => updateRegion(r.id, { name: e.target.value })}
                />
              </div>
              {r.is_homeland && <span className="text-xs text-storm-400">homeland</span>}
            </div>
            <div>
              <div className="label-tiny">Player-visible lore</div>
              <textarea
                className="input min-h-[3rem] resize-y"
                value={r.kingdom_lore}
                disabled={readOnly}
                onChange={(e) => updateRegion(r.id, { kingdom_lore: e.target.value })}
              />
            </div>
            {!readOnly && (
              <div>
                <div className="label-tiny">DM-only lore</div>
                <textarea
                  className="input min-h-[3rem] resize-y"
                  value={r.dm_lore}
                  onChange={(e) => updateRegion(r.id, { dm_lore: e.target.value })}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
