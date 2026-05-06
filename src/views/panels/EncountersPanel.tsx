import { useState } from 'react'
import { useCampaign } from '../../store/campaign'
import { BIOME_LABEL } from '../../world/biomes'

// Encounters are DM-only — no readOnly variant since players never see them.
export function EncountersPanel() {
  const { encounters, hexes, selected, setSelected, addEncounter, updateEncounter, deleteEncounter, myRole } =
    useCampaign()
  const [draft, setDraft] = useState('')
  if (myRole !== 'dm') {
    return <div className="p-4 text-ink-300 text-sm">Encounters are DM-only.</div>
  }
  const selectedHex = selected ? hexes.find((h) => h.q === selected.q && h.r === selected.r) : null
  const selectionLabel = selectedHex
    ? `${BIOME_LABEL[selectedHex.biome]} (${selectedHex.q}, ${selectedHex.r})`
    : null
  return (
    <div className="p-4 space-y-3 text-sm overflow-y-auto h-full">
      <div className="text-xs text-ink-300">
        {selectionLabel ? (
          <>
            Tile selected: <span className="text-ink-100">{selectionLabel}</span>
            <button className="ml-2 underline text-ink-300" onClick={() => setSelected(null)}>
              clear
            </button>
          </>
        ) : (
          <span className="italic">No tile selected — encounters added now will be unpinned.</span>
        )}
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          addEncounter(draft.trim(), selected ?? null)
          setDraft('')
        }}
      >
        <textarea
          className="input min-h-[3rem] resize-y"
          placeholder="New encounter (e.g., '3 bandits ambush at dusk')…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn btn-primary self-end" type="submit">
          Add encounter
        </button>
      </form>
      {encounters.length === 0 && <div className="text-ink-300">No encounters yet.</div>}
      <ul className="space-y-2">
        {encounters.map((e) => (
          <li key={e.id} className="panel p-3 space-y-2">
            <textarea
              className="input min-h-[3rem] resize-y"
              value={e.text}
              onChange={(ev) => updateEncounter(e.id, { text: ev.target.value })}
            />
            <div className="flex items-center justify-between gap-2 text-xs text-ink-300">
              <div className="flex items-center gap-2">
                <span>
                  Pin:{' '}
                  {e.target_q != null && e.target_r != null ? (
                    <span className="text-orange-300">({e.target_q}, {e.target_r})</span>
                  ) : (
                    <span className="italic">unpinned</span>
                  )}
                </span>
                {selected && (
                  <button
                    className="btn text-xs py-1 px-2"
                    onClick={() => updateEncounter(e.id, { target_q: selected.q, target_r: selected.r })}
                  >
                    pin to {selectionLabel}
                  </button>
                )}
                {e.target_q != null && (
                  <button
                    className="btn text-xs py-1 px-2"
                    onClick={() => updateEncounter(e.id, { target_q: null, target_r: null })}
                  >
                    unpin
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  className="btn text-xs py-1 px-2"
                  onClick={() => updateEncounter(e.id, { used: !e.used })}
                >
                  {e.used ? 'mark fresh' : 'mark used'}
                </button>
                <button className="btn btn-danger text-xs py-1 px-2" onClick={() => deleteEncounter(e.id)}>
                  Delete
                </button>
              </div>
            </div>
            {e.used && <div className="text-xs text-ink-300 italic">used</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}
