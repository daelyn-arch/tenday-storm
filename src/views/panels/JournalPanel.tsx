import { useEffect, useState } from 'react'
import { useCampaign } from '../../store/campaign'
import { supabase } from '../../lib/supabase'

export function JournalPanel() {
  const { journal, addJournal, updateJournal, deleteJournal } = useCampaign()
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

  return (
    <div className="p-4 space-y-3 text-sm overflow-y-auto h-full flex flex-col">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          addJournal(draft.trim(), author)
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
                  {isMine && (
                    <div className="flex gap-2 justify-end text-xs">
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
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
