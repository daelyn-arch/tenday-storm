import { useState } from 'react'
import { useCampaign } from '../../store/campaign'
import { BIOME_LABEL } from '../../world/biomes'

export function QuestsPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { quests, hexes, selected, setSelected, addQuest, updateQuest, deleteQuest, myRole } = useCampaign()
  const [draft, setDraft] = useState('')
  const visibleQuests = readOnly ? quests.filter((q) => q.player_visible) : quests
  const selectedHex = selected ? hexes.find((h) => h.q === selected.q && h.r === selected.r) : null
  const selectionLabel = selectedHex
    ? `${BIOME_LABEL[selectedHex.biome]} (${selectedHex.q}, ${selectedHex.r})`
    : null
  return (
    <div className="p-4 space-y-3 text-sm overflow-y-auto h-full">
      {!readOnly && myRole === 'dm' && (
        <>
          <div className="text-xs text-ink-300">
            {selectionLabel ? (
              <>
                Tile selected: <span className="text-ink-100">{selectionLabel}</span>
                <button className="ml-2 underline text-ink-300" onClick={() => setSelected(null)}>
                  clear
                </button>
              </>
            ) : (
              <span className="italic">No tile selected — quests added now will be unpinned.</span>
            )}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!draft.trim()) return
              addQuest(draft.trim(), selected ?? null)
              setDraft('')
            }}
          >
            <input
              className="input"
              placeholder="New quest title…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button className="btn btn-primary shrink-0" type="submit">
              Add
            </button>
          </form>
        </>
      )}
      {visibleQuests.length === 0 && <div className="text-ink-300">No quests yet.</div>}
      <ul className="space-y-3">
        {visibleQuests.map((q) => (
          <li key={q.id} className="panel p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <input
                className="input bg-transparent border-transparent font-display text-base px-0"
                value={q.title}
                disabled={readOnly}
                onChange={(e) => updateQuest(q.id, { title: e.target.value })}
              />
              {!readOnly && (
                <select
                  className="input w-auto"
                  value={q.status}
                  onChange={(e) => updateQuest(q.id, { status: e.target.value as 'open' | 'completed' | 'failed' })}
                >
                  <option value="open">open</option>
                  <option value="completed">done</option>
                  <option value="failed">failed</option>
                </select>
              )}
            </div>
            <textarea
              className="input min-h-[4rem] resize-y"
              value={q.body}
              disabled={readOnly}
              onChange={(e) => updateQuest(q.id, { body: e.target.value })}
              placeholder="Details…"
            />
            {!readOnly && (
              <div className="flex items-center justify-between gap-2 text-xs text-ink-300">
                <div className="flex items-center gap-2">
                  <span>
                    Pin:{' '}
                    {q.target_q != null && q.target_r != null ? (
                      <span className="text-yellow-300">({q.target_q}, {q.target_r})</span>
                    ) : (
                      <span className="italic">unpinned</span>
                    )}
                  </span>
                  {selected && (
                    <button
                      className="btn text-xs py-1 px-2"
                      onClick={() => updateQuest(q.id, { target_q: selected.q, target_r: selected.r })}
                    >
                      pin to {selectionLabel}
                    </button>
                  )}
                  {q.target_q != null && (
                    <button
                      className="btn text-xs py-1 px-2"
                      onClick={() => updateQuest(q.id, { target_q: null, target_r: null })}
                    >
                      unpin
                    </button>
                  )}
                </div>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={q.player_visible}
                    onChange={(e) => updateQuest(q.id, { player_visible: e.target.checked })}
                  />
                  visible
                </label>
                <button className="btn btn-danger text-xs py-1 px-2" onClick={() => deleteQuest(q.id)}>
                  Delete
                </button>
              </div>
            )}
            {readOnly && q.target_q != null && q.target_r != null && (
              <div className="text-xs text-yellow-300">Pinned: ({q.target_q}, {q.target_r})</div>
            )}
            {readOnly && q.status !== 'open' && (
              <div className="text-xs text-ink-300">Status: {q.status}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
