import { useEffect, useState } from 'react'
import { useCampaign } from '../../store/campaign'
import { supabase } from '../../lib/supabase'
import { BIOME_LABEL } from '../../world/biomes'

export function JournalPanel() {
  const { journal, hexes, selected, setSelected, addJournal, updateJournal, deleteJournal } = useCampaign()
  const [author, setAuthor] = useState('')
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setAuthor(data.user?.email ?? 'anon')
    })
    return () => {
      mounted = false
    }
  }, [])

  const selectedHex = selected ? hexes.find((h) => h.q === selected.q && h.r === selected.r) : null
  const selectionLabel = selectedHex
    ? `${BIOME_LABEL[selectedHex.biome]} (${selectedHex.q}, ${selectedHex.r})`
    : null

  return (
    <div className="p-4 space-y-3 text-sm overflow-y-auto h-full flex flex-col">
      <div className="text-xs text-ink-300">
        {selectionLabel ? (
          <>
            Tile selected: <span className="text-ink-100">{selectionLabel}</span>
            <button className="ml-2 underline text-ink-300" onClick={() => setSelected(null)}>
              clear
            </button>
          </>
        ) : (
          <span className="italic">No tile selected — entries posted now will be unpinned.</span>
        )}
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          addJournal(draft.trim(), author, selected ?? null)
          setDraft('')
        }}
      >
        <textarea
          className="input min-h-[5rem] resize-y"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Journal entry as ${author}…`}
        />
        <div className="flex justify-end">
          <button className="btn btn-primary" type="submit">
            Post
          </button>
        </div>
      </form>

      <ul className="space-y-3">
        {journal.length === 0 && <div className="text-ink-300">No entries yet.</div>}
        {journal.map((j) => {
          const isMine = j.author === author
          const isEditing = editingId === j.id
          return (
            <li key={j.id} className="panel p-3 space-y-2">
              <div className="flex justify-between text-xs text-ink-300">
                <span>{j.author}</span>
                <span>{new Date(j.created_at).toLocaleString()}</span>
              </div>
              {isEditing ? (
                <>
                  <textarea
                    className="input min-h-[5rem] resize-y"
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      className="btn"
                      onClick={() => {
                        setEditingId(null)
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        await updateJournal(j.id, { body: editingBody })
                        setEditingId(null)
                      }}
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="whitespace-pre-wrap">{j.body}</div>
                  <div className="flex items-center justify-between gap-2 text-xs text-ink-300">
                    <div className="flex items-center gap-2">
                      <span>
                        Pin:{' '}
                        {j.target_q != null && j.target_r != null ? (
                          <span className="text-cyan-300">({j.target_q}, {j.target_r})</span>
                        ) : (
                          <span className="italic">unpinned</span>
                        )}
                      </span>
                      {selected && (
                        <button
                          className="btn text-xs py-1 px-2"
                          onClick={() => updateJournal(j.id, { target_q: selected.q, target_r: selected.r })}
                        >
                          pin to {selectionLabel}
                        </button>
                      )}
                      {j.target_q != null && (
                        <button
                          className="btn text-xs py-1 px-2"
                          onClick={() => updateJournal(j.id, { target_q: null, target_r: null })}
                        >
                          unpin
                        </button>
                      )}
                    </div>
                    {isMine && (
                      <div className="flex gap-2">
                        <button
                          className="btn text-xs py-1 px-2"
                          onClick={() => {
                            setEditingId(j.id)
                            setEditingBody(j.body)
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger text-xs py-1 px-2"
                          onClick={() => deleteJournal(j.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
