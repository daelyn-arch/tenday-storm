import { useState } from 'react'
import { useCampaign } from '../../store/campaign'
import { BIOME_LABEL } from '../../world/biomes'

type AssignChoice =
  | { kind: 'unassigned' }
  | { kind: 'quest'; id: string }
  | { kind: 'rumor'; id: string }

function parseAssign(value: string): AssignChoice {
  if (value === '' || value === 'unassigned') return { kind: 'unassigned' }
  const [kind, id] = value.split(':')
  if (kind === 'quest') return { kind: 'quest', id }
  if (kind === 'rumor') return { kind: 'rumor', id }
  return { kind: 'unassigned' }
}

function serializeAssign(a: AssignChoice): string {
  if (a.kind === 'unassigned') return 'unassigned'
  return `${a.kind}:${a.id}`
}

export function ItemsPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { items, quests, rumors, hexes, selected, setSelected, addItem, updateItem, deleteItem, myRole } =
    useCampaign()
  const [draft, setDraft] = useState('')
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [pendingAssign, setPendingAssign] = useState<AssignChoice>({ kind: 'unassigned' })
  const visibleItems = readOnly ? items.filter((i) => i.discovered && i.is_real) : items
  const selectedHex = selected ? hexes.find((h) => h.q === selected.q && h.r === selected.r) : null
  const selectionLabel = selectedHex
    ? `${BIOME_LABEL[selectedHex.biome]} (${selectedHex.q}, ${selectedHex.r})`
    : null

  function commitPending() {
    if (!pendingName) return
    const tile = selected ?? null
    const assignment =
      pendingAssign.kind === 'unassigned'
        ? null
        : pendingAssign.kind === 'quest'
        ? { questId: pendingAssign.id, rumorId: null }
        : { questId: null, rumorId: pendingAssign.id }
    addItem(pendingName, true, assignment, tile)
    setPendingName(null)
    setPendingAssign({ kind: 'unassigned' })
  }

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
              <span className="italic">No tile selected — items added now will have no tile.</span>
            )}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!draft.trim()) return
              setPendingName(draft.trim())
              setPendingAssign({ kind: 'unassigned' })
              setDraft('')
            }}
          >
            <input
              className="input"
              placeholder="New item name…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button className="btn btn-primary shrink-0" type="submit">
              Add
            </button>
          </form>
          {pendingName && (
            <div className="panel p-3 space-y-2 border border-storm-400/40">
              <div className="font-display text-base">Assign &ldquo;{pendingName}&rdquo;</div>
              <select
                className="input"
                value={serializeAssign(pendingAssign)}
                onChange={(e) => setPendingAssign(parseAssign(e.target.value))}
              >
                <option value="unassigned">— unassigned —</option>
                {quests.length > 0 && (
                  <optgroup label="Quests">
                    {quests.map((q) => (
                      <option key={`q-${q.id}`} value={`quest:${q.id}`}>
                        {q.title}
                      </option>
                    ))}
                  </optgroup>
                )}
                {rumors.length > 0 && (
                  <optgroup label="Rumors">
                    {rumors.map((r) => (
                      <option key={`r-${r.id}`} value={`rumor:${r.id}`}>
                        {r.text.slice(0, 60)}
                        {r.text.length > 60 ? '…' : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <div className="text-xs text-ink-300">
                Tile: {selectionLabel ?? <span className="italic">none</span>}
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={commitPending}>
                  Save item
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setPendingName(null)
                    setPendingAssign({ kind: 'unassigned' })
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <ul className="space-y-2">
        {visibleItems.map((it) => {
          const assignedQuest = it.quest_id ? quests.find((q) => q.id === it.quest_id) : null
          const assignedRumor = it.rumor_id ? rumors.find((r) => r.id === it.rumor_id) : null
          const currentValue: AssignChoice = it.quest_id
            ? { kind: 'quest', id: it.quest_id }
            : it.rumor_id
            ? { kind: 'rumor', id: it.rumor_id }
            : { kind: 'unassigned' }
          return (
            <li key={it.id} className="panel p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <input
                  className="input bg-transparent border-transparent font-display text-base px-0"
                  value={it.name}
                  disabled={readOnly}
                  onChange={(e) => updateItem(it.id, { name: e.target.value })}
                />
                {!readOnly && (
                  <span className={`text-xs ${it.is_real ? 'text-emerald-400' : 'text-red-400'}`}>
                    {it.is_real ? 'real' : 'fake'}
                  </span>
                )}
              </div>
              <textarea
                className="input min-h-[3rem] resize-y"
                value={it.description}
                disabled={readOnly}
                onChange={(e) => updateItem(it.id, { description: e.target.value })}
                placeholder="Description / mechanics…"
              />
              {!readOnly && (
                <div className="text-xs text-ink-300 space-y-1">
                  <div className="flex items-center gap-2">
                    <span>Assigned to:</span>
                    <select
                      className="input"
                      value={serializeAssign(currentValue)}
                      onChange={(e) => {
                        const next = parseAssign(e.target.value)
                        if (next.kind === 'unassigned') {
                          updateItem(it.id, { quest_id: null, rumor_id: null })
                        } else if (next.kind === 'quest') {
                          updateItem(it.id, { quest_id: next.id, rumor_id: null })
                        } else {
                          updateItem(it.id, { quest_id: null, rumor_id: next.id })
                        }
                      }}
                    >
                      <option value="unassigned">— unassigned —</option>
                      {quests.length > 0 && (
                        <optgroup label="Quests">
                          {quests.map((q) => (
                            <option key={`q-${q.id}`} value={`quest:${q.id}`}>
                              {q.title}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {rumors.length > 0 && (
                        <optgroup label="Rumors">
                          {rumors.map((r) => (
                            <option key={`r-${r.id}`} value={`rumor:${r.id}`}>
                              {r.text.slice(0, 60)}
                              {r.text.length > 60 ? '…' : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>
                      Tile:{' '}
                      {it.hex_q != null && it.hex_r != null ? (
                        <span className="text-ink-100">({it.hex_q}, {it.hex_r})</span>
                      ) : (
                        <span className="italic">none</span>
                      )}
                    </span>
                    {selected && (
                      <button
                        className="btn text-xs py-1 px-2"
                        onClick={() => updateItem(it.id, { hex_q: selected.q, hex_r: selected.r })}
                      >
                        set to {selectionLabel}
                      </button>
                    )}
                    {it.hex_q != null && (
                      <button
                        className="btn text-xs py-1 px-2"
                        onClick={() => updateItem(it.id, { hex_q: null, hex_r: null })}
                      >
                        clear tile
                      </button>
                    )}
                  </div>
                  <div className="flex justify-between items-center gap-2 pt-1">
                    {it.in_party_inventory && <span className="text-storm-400">in inventory</span>}
                    <div className="flex gap-2 ml-auto">
                      <button
                        className="btn text-xs py-1 px-2"
                        onClick={() => updateItem(it.id, { discovered: !it.discovered })}
                      >
                        {it.discovered ? 'un-discover' : 'mark discovered'}
                      </button>
                      <button
                        className="btn text-xs py-1 px-2"
                        onClick={() => updateItem(it.id, { in_party_inventory: !it.in_party_inventory })}
                      >
                        {it.in_party_inventory ? 'remove from party' : 'give to party'}
                      </button>
                      <button className="btn btn-danger text-xs py-1 px-2" onClick={() => deleteItem(it.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {readOnly && (
                <div className="text-xs text-ink-300">
                  {assignedQuest && <>Quest: {assignedQuest.title} </>}
                  {assignedRumor && <>Rumor: {assignedRumor.text.slice(0, 60)} </>}
                  {it.in_party_inventory && <span className="text-storm-400">in inventory</span>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
