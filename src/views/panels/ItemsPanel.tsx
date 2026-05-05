import { useState } from 'react'
import { useCampaign } from '../../store/campaign'

export function ItemsPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { items, addItem, updateItem, deleteItem, myRole } = useCampaign()
  const [draft, setDraft] = useState('')
  const visibleItems = readOnly ? items.filter((i) => i.discovered && i.is_real) : items
  return (
    <div className="p-4 space-y-3 text-sm overflow-y-auto h-full">
      {!readOnly && myRole === 'dm' && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.trim()) return
            addItem(draft.trim(), true)
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
            Add real
          </button>
        </form>
      )}
      <ul className="space-y-2">
        {visibleItems.map((it) => (
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
            <div className="text-xs text-ink-300 flex items-center justify-between">
              <div>
                {it.hex_q != null && it.hex_r != null
                  ? `Hex (${it.hex_q}, ${it.hex_r})`
                  : 'Unplaced'}
                {it.in_party_inventory && <span className="ml-3 text-storm-400">in inventory</span>}
              </div>
              {!readOnly && (
                <div className="flex gap-2">
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
              )}
              {readOnly && it.in_party_inventory && (
                <span className="text-storm-400">in inventory</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
